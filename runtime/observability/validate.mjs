#!/usr/bin/env node
// validate.mjs — the run-record sink selftest. Time is pinned (no real clock), so the record is a
// pure, deterministic function of its input. Proves: ts injection, the two-part verify object,
// redaction (raw reasons never survive), opt-in no-op, append-only NDJSON write, and fail-open on an
// unwritable path. Lives under runtime/ — NOT discovered by `validate.mjs --all` (that scans
// standards/ + primitives/); run it directly, or in CI alongside the scheduler selftest.

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildRunRecord, reasonHash, redactGateDecisions } from './lib/record.mjs';
import { appendRunRecord } from './sink.mjs';

const NOW = new Date(Date.parse('2026-06-25T12:00:00Z'));
const checks = [];
const ok = (name, cond, detail = '') => {
  checks.push({ name, pass: !!cond, detail });
  return !!cond;
};

// ── buildRunRecord: ts injection + typed shape ──────────────────────────────────
const rec = buildRunRecord(
  {
    task_id: 'T-1',
    slice: 'impl',
    model: 'm',
    effort: 'high',
    attempts: 2,
    verify: { first_pass: false, result: 'pass' },
    gate_decisions: [
      { decision: 'deny', rules: ['recursive-force-delete'], reason: 'rm -rf /tmp/secretproj' },
    ],
  },
  NOW,
);
ok(
  'buildRunRecord: ts injected from the supplied clock',
  rec.ts === '2026-06-25T12:00:00.000Z',
  rec.ts,
);
ok('buildRunRecord: attempts preserved', rec.attempts === 2);
ok(
  'buildRunRecord: verify is the two-part object',
  rec.verify.first_pass === false && rec.verify.result === 'pass',
);
ok('buildRunRecord: attempts defaults to 1', buildRunRecord({}, NOW).attempts === 1);
ok(
  'buildRunRecord: an unknown verify.result coerces to fail',
  buildRunRecord({ verify: { result: 'huh' } }, NOW).verify.result === 'fail',
);

// ── redaction: the raw reason NEVER survives ────────────────────────────────────
const serialized = JSON.stringify(rec);
ok(
  'redaction: raw reason text absent from the record',
  !serialized.includes('secretproj') && !serialized.includes('rm -rf'),
);
ok(
  'redaction: gate decision keeps only decision/rules/reason_hash',
  JSON.stringify(Object.keys(rec.gate_decisions[0]).sort()) ===
    JSON.stringify(['decision', 'reason_hash', 'rules']),
);
ok(
  'reasonHash: stable sha256/12',
  reasonHash('x') === reasonHash('x') && /^[0-9a-f]{12}$/.test(reasonHash('x')),
);
ok(
  'redactGateDecisions: non-array → []',
  Array.isArray(redactGateDecisions(undefined)) && redactGateDecisions(undefined).length === 0,
);

// ── sink: opt-in + append-only NDJSON + fail-open ───────────────────────────────
ok(
  'sink: opt-out (no logPath) writes nothing',
  appendRunRecord(rec, { logPath: undefined, now: NOW }) === null,
);

const dir = mkdtempSync(join(tmpdir(), 'runrecord-selftest-'));
const logPath = join(dir, 'runs.ndjson');
try {
  const w1 = appendRunRecord(
    { task_id: 'A', slice: 's', verify: { first_pass: true, result: 'pass' } },
    { logPath, now: NOW },
  );
  appendRunRecord(
    { task_id: 'B', slice: 's', verify: { first_pass: false, result: 'fail' } },
    { logPath, now: NOW },
  );
  ok('sink: a configured write returns the record', !!w1 && w1.task_id === 'A');
  const lines = existsSync(logPath)
    ? readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean)
    : [];
  ok(
    'sink: append-only — two writes → two NDJSON lines',
    lines.length === 2,
    `got ${lines.length}`,
  );
  ok(
    'sink: each line is one parseable JSON object',
    lines.every((l) => {
      try {
        JSON.parse(l);
        return true;
      } catch {
        return false;
      }
    }),
  );
  ok(
    'sink: fail-open on an unwritable path returns null',
    appendRunRecord(rec, { logPath: join(dir, 'no-such-subdir', 'x.ndjson'), now: NOW }) === null,
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}

const failed = checks.filter((c) => !c.pass);
for (const c of checks)
  if (!c.pass) console.log(`  FAIL ${c.name}${c.detail ? `  [${c.detail}]` : ''}`);
console.log(
  `observability: ${checks.length - failed.length}/${checks.length} selftest checks passed`,
);
process.exit(failed.length ? 1 : 0);
