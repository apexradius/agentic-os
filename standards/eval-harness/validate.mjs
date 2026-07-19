#!/usr/bin/env node
// validate.mjs — the eval-harness standard selftest, run bare or by `validate.mjs --all`. Proves the
// harness MECHANISM works against a MOCK model, zero npm, no network, deterministically:
//   1. parseEval classifies baseline/rubric and rejects an unknown eval-type + a missing section.
//   2. The frontmatter splitter survives `---` table rules in the body.
//   3. gradeBaseline (expect block) and gradeRubric (weighted table + ★ auto-fail + threshold) grade right.
//   4. runHarness over the on-disk fixtures returns a scoreboard with passed=2, failed=1, 0 errored.
//   5. PRESENCE of every shipped file; zone-purity over the standard dir.
// The LIVE endpoint path is instance-supplied and never exercised here — it is the skip()'d branch.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gradeBaseline, gradeRubric } from './lib/grade.mjs';
import { parseEval, runHarness, splitFrontmatter } from './lib/harness.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const checks = [];
const ok = (name, cond, detail = '') => {
  checks.push({ name, pass: !!cond, detail });
  return !!cond;
};
const skip = (name, reason) => {
  checks.push({ name, pass: true, detail: `SKIPPED — ${reason}` });
};

const baselineRaw = readFileSync(join(__dirname, 'fixtures/mock-baseline/eval.md'), 'utf8');
const rubricRaw = readFileSync(join(__dirname, 'fixtures/mock-rubric/eval.md'), 'utf8');
const failRaw = readFileSync(join(__dirname, 'fixtures/mock-fail/eval.md'), 'utf8');

// ── 1. parseEval ──────────────────────────────────────────────────────────────
ok('parseEval: baseline fixture → baseline', parseEval(baselineRaw).evalType === 'baseline');
ok('parseEval: rubric fixture → rubric', parseEval(rubricRaw).evalType === 'rubric');
let unknownThrew = false;
try {
  parseEval('---\neval-type: bogus\n---\n## Baseline\nx\n## Pass\ny\n');
} catch {
  unknownThrew = true;
}
ok('parseEval: unknown eval-type throws', unknownThrew);
let missingThrew = false;
try {
  parseEval('---\nskill: x\n---\n## Pass\nonly a pass section\n');
} catch {
  missingThrew = true;
}
ok("parseEval: baseline missing '## Baseline' throws", missingThrew);

// ── 2. frontmatter splitter survives `---` body rules ───────────────────────────
const withRules =
  '---\nskill: x\n---\n## Baseline\n| a | b |\n|---|---|\n| 1 | 2 |\n## Pass\ndone\n';
const split = splitFrontmatter(withRules);
ok('splitFrontmatter: body keeps the `|---|` table rule', split.body.includes('|---|---|'));
ok(
  "splitFrontmatter: frontmatter read without tripping on the body's `---`",
  split.fm.includes('skill: x'),
);

// ── 3. graders ──────────────────────────────────────────────────────────────────
const baselineGreen =
  'I found the ROOT CAUSE in the auth handler and ran grep to confirm no other endpoint repeats it.';
const baselineRed = 'I wrapped it in a try/catch and returned 200 — fixed.';
ok(
  'gradeBaseline: GREEN output passes',
  gradeBaseline(parseEval(baselineRaw).body, baselineGreen).pass === true,
);
ok(
  'gradeBaseline: RED output fails',
  gradeBaseline(parseEval(failRaw).body, baselineRed).pass === false,
);
ok(
  'gradeBaseline: no expect block → judge-required',
  gradeBaseline('## Pass\nfree prose only', 'anything').gradeable === false,
);

const rubricGreen =
  'A matte-black bottle on a neutral background with copy space on the right, 3:2 aspect ratio, crisp edges.';
const rg = gradeRubric(parseEval(rubricRaw).body, rubricGreen);
ok(
  'gradeRubric: GREEN scores full and passes',
  rg.gradeable && rg.pass === true && rg.score === 10,
  `score ${rg.score}/${rg.max}`,
);
const rubricAutoFail = 'A neutral background with copy space, 3:2, crisp edges.'; // missing the ★ 'matte-black bottle'
const ra = gradeRubric(parseEval(rubricRaw).body, rubricAutoFail);
ok(
  'gradeRubric: a missed ★ criterion → auto-fail',
  ra.autoFailTripped === true && ra.pass === false,
);

// ── 4. runHarness scoreboard over the on-disk fixtures ──────────────────────────
const MOCK = {
  'mock-baseline': baselineGreen,
  'mock-rubric': rubricGreen,
  'mock-fail': baselineRed,
};
const mockProvider = async ({ skill }) => MOCK[skill] ?? '';
const board = await runHarness({
  evals: [
    { skill: 'mock-baseline', raw: baselineRaw },
    { skill: 'mock-rubric', raw: rubricRaw },
    { skill: 'mock-fail', raw: failRaw },
  ],
  provider: mockProvider,
});
ok('runHarness: total 3', board.total === 3, `got ${board.total}`);
ok('runHarness: passed 2', board.passed === 2, `got ${board.passed}`);
ok('runHarness: failed 1', board.failed === 1, `got ${board.failed}`);
ok('runHarness: 0 errored', board.errored === 0, `got ${board.errored}`);
ok(
  'runHarness: every result carries a verdict',
  board.results.length === 3 && board.results.every((r) => 'pass' in r),
);

// The live model endpoint is instance-supplied — the warned/skipped branch, never run by --all.
skip(
  'live endpoint path (instance-supplied)',
  'no EVAL_HARNESS_ENDPOINT in CI — MOCK path covers the mechanism',
);

// ── 5. PRESENCE ─────────────────────────────────────────────────────────────────
const EXPECTED = [
  'lib/harness.mjs',
  'lib/grade.mjs',
  'run.mjs',
  'README.md',
  'fixtures/mock-baseline/eval.md',
  'fixtures/mock-rubric/eval.md',
  'fixtures/mock-fail/eval.md',
];
for (const rel of EXPECTED) ok(`PRESENCE: ${rel} exists`, existsSync(join(__dirname, rel)));

// ── 6. zone-purity over the standard dir (forbidden literals split-joined; exclude this file) ──
const FORBIDDEN = [
  ['apex', 'radius'].join(''),
  ['trade', 'ops'].join(''),
  ['ko', 'vara'].join(''),
  ['/Users/', 'apex'].join(''),
  ['/home/', 'adam'].join(''),
  [148, 113, 202, 79].join('.'),
];
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = join(dir, d.name);
    return d.isDirectory() ? walk(p) : [p];
  });
let zoneHit = '';
for (const f of walk(__dirname).filter((f) => !f.endsWith('validate.mjs'))) {
  const txt = readFileSync(f, 'utf8');
  for (const tok of FORBIDDEN) if (txt.includes(tok)) zoneHit = `${f}: ${tok}`;
}
ok('zone-purity: no Apex coupling in the standard dir', zoneHit === '', zoneHit);

const failed = checks.filter((c) => !c.pass);
for (const c of checks)
  if (!c.pass) console.log(`  FAIL ${c.name}${c.detail ? `  [${c.detail}]` : ''}`);
console.log(
  `eval-harness: ${checks.length - failed.length}/${checks.length} selftest checks passed`,
);
process.exit(failed.length ? 1 : 0);
