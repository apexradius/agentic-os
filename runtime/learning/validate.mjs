#!/usr/bin/env node
// validate.mjs — the learning-loop analyzer selftest. Time is pinned (no real clock), so the report is
// a pure, deterministic function of the run-records. Proves: tolerant NDJSON parse, per-slice failure +
// rework aggregation, duration/cost outlier detection vs the median, one-sided gate-skew detection (and
// exclusion of a balanced rule), bounded candidates (never more than --top), and the read-only guardrail
// surfaced in output. Lives under runtime/ — NOT discovered by `validate.mjs --all`; run it directly or
// alongside the observability selftest in CI.

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReport, gateSkew, parseRunRecords, summarizeBySlice } from './lib/analyze.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const NOW = new Date(Date.parse('2026-06-25T12:00:00Z'));
const checks = [];
const ok = (name, cond, detail = '') => {
  checks.push({ name, pass: !!cond, detail });
  return !!cond;
};

// ── a synthetic run-record log exercising every signal ──────────────────────────
const rec = (o) =>
  JSON.stringify({
    ts: '2026-06-25T10:00:00.000Z',
    attempts: 1,
    verify: { first_pass: true, result: 'pass' },
    gate_decisions: [],
    ...o,
  });
const G = (extra) => [
  { decision: 'deny', rules: ['recursive-force-delete'], reason_hash: 'h0' },
  { decision: 'allow', rules: ['read-file'], reason_hash: 'h1' },
  extra,
];
const ndjson = [
  // slice "impl": T-1,T-2 fail, T-3 pass → recurring failure (fails >= 2)
  rec({ task_id: 'T-1', slice: 'impl', verify: { first_pass: false, result: 'fail' } }),
  rec({ task_id: 'T-2', slice: 'impl', verify: { first_pass: false, result: 'fail' } }),
  rec({ task_id: 'T-3', slice: 'impl' }),
  // slice "test": two runs with >1 attempt → rework hotspot
  rec({ task_id: 'T-4', slice: 'test', attempts: 3 }),
  rec({ task_id: 'T-5', slice: 'test', attempts: 2 }),
  // slice "docs": one large duration + cost vs small medians → outliers
  rec({ task_id: 'T-6', slice: 'docs', duration: 50, cost: 0.05 }),
  rec({ task_id: 'T-7', slice: 'docs', duration: 60, cost: 0.06 }),
  rec({ task_id: 'T-8', slice: 'docs', duration: 800, cost: 4.0 }),
  // three runs each carrying: always-deny rule, always-allow rule, and a balanced "mixed" rule
  rec({
    task_id: 'G-1',
    slice: 'impl',
    gate_decisions: G({ decision: 'deny', rules: ['mixed'], reason_hash: 'm1' }),
  }),
  rec({
    task_id: 'G-2',
    slice: 'test',
    gate_decisions: G({ decision: 'allow', rules: ['mixed'], reason_hash: 'm2' }),
  }),
  rec({
    task_id: 'G-3',
    slice: 'docs',
    gate_decisions: G({ decision: 'allow', rules: ['mixed'], reason_hash: 'm3' }),
  }),
  '{ not json', // malformed — must be skipped
  '', // blank — must be skipped
].join('\n');

const records = parseRunRecords(ndjson);
ok(
  'parseRunRecords: tolerant — skips blank + malformed lines',
  records.length === 11,
  `got ${records.length}`,
);

// ── per-slice aggregation ───────────────────────────────────────────────────────
const slices = summarizeBySlice(records);
const impl = slices.find((s) => s.slice === 'impl');
ok('summarizeBySlice: impl counts every run on the slice', impl.runs === 4, `runs=${impl?.runs}`); // T-1,T-2,T-3,G-1
ok('summarizeBySlice: impl counts the Verify fails', impl.fails === 2, `fails=${impl?.fails}`);
const test = slices.find((s) => s.slice === 'test');
ok(
  'summarizeBySlice: rework runs counted (attempts>1)',
  test.reworkRuns === 2,
  `rework=${test?.reworkRuns}`,
);

// ── gate skew: one-sided detected, balanced excluded ────────────────────────────
const skew = gateSkew(records, 3);
ok(
  'gateSkew: finds the always-deny rule',
  skew.some((g) => g.rule === 'recursive-force-delete' && g.skewed === 'deny'),
);
ok(
  'gateSkew: finds the always-allow rule',
  skew.some((g) => g.rule === 'read-file' && g.skewed === 'allow'),
);
ok("gateSkew: excludes the balanced 'mixed' rule", !skew.some((g) => g.rule === 'mixed'));
ok('gateSkew: only the two one-sided rules qualify', skew.length === 2, `len=${skew.length}`);

// ── full report ─────────────────────────────────────────────────────────────────
const rep = buildReport(records, { now: NOW });
ok(
  'buildReport: generated_at is the injected clock (deterministic)',
  rep.generated_at === '2026-06-25T12:00:00.000Z',
  rep.generated_at,
);
ok('buildReport: window total counts parsed records', rep.window.total === 11);
ok(
  'buildReport: recurring_failures surfaces impl',
  rep.signals.recurring_failures.some((f) => f.slice === 'impl' && f.fails === 2),
);
ok(
  'buildReport: impl fail_rate is 2/4',
  rep.signals.recurring_failures.find((f) => f.slice === 'impl')?.fail_rate === 0.5,
);
ok(
  'buildReport: rework_hotspots surfaces test with avg attempts',
  rep.signals.rework_hotspots.some((h) => h.slice === 'test' && h.avg_attempts === 2),
);
ok(
  'buildReport: duration outlier is T-8 over median 60',
  rep.signals.duration_outliers.median === 60 &&
    rep.signals.duration_outliers.items.some((o) => o.task_id === 'T-8'),
);
ok(
  'buildReport: cost outlier is T-8 over a small median',
  rep.signals.cost_outliers.items.some((o) => o.task_id === 'T-8') &&
    rep.signals.cost_outliers.median < 1,
);
ok(
  'buildReport: top candidate is the recurring failure on impl',
  rep.candidates[0]?.kind === 'recurring-failure' && rep.candidates[0]?.subject === 'impl',
);
ok(
  'buildReport: candidates cite evidence',
  rep.candidates.every((c) => c.evidence && Object.keys(c.evidence).length > 0),
);
ok(
  'buildReport: candidates carry no internal severity field',
  rep.candidates.every((c) => !('severity' in c)),
);
ok(
  'buildReport: candidates are bounded by --top',
  buildReport(records, { now: NOW, top: 1 }).candidates.length === 1,
);
ok(
  'buildReport: the read-only guardrail is stated in output',
  /never edits the framework/i.test(rep.note),
);

// ── empty input degrades cleanly ────────────────────────────────────────────────
const empty = buildReport([], { now: NOW });
ok(
  'buildReport: empty input → no candidates, zero window',
  empty.candidates.length === 0 && empty.window.total === 0 && empty.window.first_ts === null,
);

// ── the module presents no write path (guardrail by construction) ───────────────
import('./lib/analyze.mjs').then((mod) => {
  ok(
    'lib exports no write/apply/mutate function',
    !Object.keys(mod).some((k) => /write|apply|mutate|commit|edit/i.test(k)),
  );

  // ── presence of the module's files ──────────────────────────────────────────
  for (const f of ['lib/analyze.mjs', 'analyze.mjs', 'validate.mjs', 'README.md']) {
    ok(`file present: ${f}`, existsSync(join(__dirname, f)));
  }

  const failed = checks.filter((c) => !c.pass);
  for (const c of checks)
    if (!c.pass) console.log(`  FAIL ${c.name}${c.detail ? `  [${c.detail}]` : ''}`);
  console.log(`learning: ${checks.length - failed.length}/${checks.length} selftest checks passed`);
  process.exit(failed.length ? 1 : 0);
});
