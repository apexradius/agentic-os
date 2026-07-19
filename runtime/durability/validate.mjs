#!/usr/bin/env node
// validate.mjs — the durability journal selftest. Time is pinned (no real clock) so entry-building
// is a pure, deterministic function; file I/O uses a throwaway temp file. Proves the behaviors the
// crash-replay rest on: opt-in no-op, fail-open, append+read-back, and replay short-circuit keyed
// by (task_id, step, idempotency_key) — including that a non-ok step is NOT replay-eligible.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendJournalEntry, buildEntry, readJournal, replayLookup } from './journal.mjs';

const NOW = new Date('2026-06-25T12:00:00Z');
const checks = [];
const ok = (name, cond, detail = '') => {
  checks.push({ name, pass: !!cond, detail });
  return !!cond;
};

// ── buildEntry: pure, deterministic, optional fields only when supplied ────────────────────────
const e = buildEntry(
  {
    task_id: 't1',
    step: 'dispatch',
    attempt: 2,
    idempotency_key: 'k1',
    result: 'ok',
    evidence: '/r/t1',
  },
  NOW,
);
ok('buildEntry: ts from injected clock', e.ts === '2026-06-25T12:00:00.000Z');
ok('buildEntry: required fields', e.task_id === 't1' && e.step === 'dispatch');
ok(
  'buildEntry: optionals carried',
  e.attempt === 2 && e.idempotency_key === 'k1' && e.result === 'ok' && e.evidence === '/r/t1',
);
ok(
  'buildEntry: omits absent optionals',
  buildEntry({ task_id: 't', step: 's' }, NOW).attempt === undefined,
);

// ── appendJournalEntry: OPT-IN + FAIL-OPEN ─────────────────────────────────────────────────────
ok(
  'append: no path → no-op (opt-in)',
  appendJournalEntry({ task_id: 't', step: 's' }, { logPath: undefined, now: NOW }) === null,
);
ok(
  'append: unwritable path → null (fail-open, no throw)',
  appendJournalEntry(
    { task_id: 't', step: 's' },
    { logPath: '/no/such/dir/journal.ndjson', now: NOW },
  ) === null,
);

// ── append + read-back round-trip ──────────────────────────────────────────────────────────────
const dir = mkdtempSync(join(tmpdir(), 'durability-'));
const file = join(dir, 'journal.ndjson');
try {
  appendJournalEntry(
    { task_id: 'task-A', step: 'dispatch', attempt: 1, idempotency_key: 'A:1', result: 'start' },
    { logPath: file, now: NOW },
  );
  appendJournalEntry(
    {
      task_id: 'task-A',
      step: 'dispatch',
      attempt: 1,
      idempotency_key: 'A:1',
      result: 'ok',
      evidence: '/r/A1',
    },
    { logPath: file, now: NOW },
  );
  appendJournalEntry(
    { task_id: 'task-A', step: 'verify', attempt: 1, idempotency_key: 'A:1', result: 'fail' },
    { logPath: file, now: NOW },
  );
  appendJournalEntry(
    { task_id: 'task-B', step: 'dispatch', attempt: 1, idempotency_key: 'B:1', result: 'start' },
    { logPath: file, now: NOW },
  );

  const entries = readJournal(file);
  ok('read-back: one object per line', entries.length === 4);
  ok(
    'read-back: NDJSON parses',
    entries.every((x) => x && x.task_id),
  );

  // Replay: the recorded ok dispatch for task-A attempt 1 is replay-eligible → skip re-running.
  const hitA = replayLookup(entries, {
    task_id: 'task-A',
    step: 'dispatch',
    idempotency_key: 'A:1',
  });
  ok(
    'replay: ok dispatch is a hit (skip re-run)',
    !!hitA && hitA.result === 'ok' && hitA.evidence === '/r/A1',
  );

  // A different attempt key has no ok record → must run (no replay).
  ok(
    'replay: wrong key → miss (must run)',
    replayLookup(entries, { task_id: 'task-A', step: 'dispatch', idempotency_key: 'A:2' }) === null,
  );

  // task-B only has a 'start' (interrupted) → NOT replay-eligible → must re-run.
  ok(
    'replay: start-only is NOT a hit (interrupted → re-run)',
    replayLookup(entries, { task_id: 'task-B', step: 'dispatch', idempotency_key: 'B:1' }) === null,
  );

  // verify-fail is not an ok/pass → not a replay hit.
  ok(
    'replay: failed verify is not a hit',
    replayLookup(entries, { task_id: 'task-A', step: 'verify', idempotency_key: 'A:1' }) === null,
  );

  // readJournal on a missing file → [] (never throws).
  ok(
    'read: missing file → [] (no throw)',
    Array.isArray(readJournal(join(dir, 'nope.ndjson'))) &&
      readJournal(join(dir, 'nope.ndjson')).length === 0,
  );

  // latest-wins: a second ok with newer evidence is the one returned.
  appendJournalEntry(
    {
      task_id: 'task-A',
      step: 'dispatch',
      attempt: 1,
      idempotency_key: 'A:1',
      result: 'ok',
      evidence: '/r/A1-newer',
    },
    { logPath: file, now: NOW },
  );
  const hit2 = replayLookup(readJournal(file), {
    task_id: 'task-A',
    step: 'dispatch',
    idempotency_key: 'A:1',
  });
  ok('replay: latest matching ok wins', hit2 && hit2.evidence === '/r/A1-newer');

  // Sanity: raw file really is newline-delimited JSON.
  ok(
    'file: trailing newline NDJSON',
    readFileSync(file, 'utf8').split('\n').filter(Boolean).length === 5,
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}

const failed = checks.filter((c) => !c.pass);
for (const c of checks)
  if (!c.pass) console.log(`  FAIL ${c.name}${c.detail ? `  [${c.detail}]` : ''}`);
console.log(`durability: ${checks.length - failed.length}/${checks.length} selftest checks passed`);
process.exit(failed.length ? 1 : 0);
