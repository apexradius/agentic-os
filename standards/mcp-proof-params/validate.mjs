#!/usr/bin/env node
// validate.mjs — the mcp-proof-params selftest, run bare by the framework harness
// (`validate.mjs --all`). Zero npm deps: it proves the proof-evaluation RULE with a
// dependency-free mirror (RED/GREEN), then statically guards that the runtime helper
// in framework/runtime/mcp-shared stays present, exported, wired, and field-aligned —
// so the MCP-substrate teeth can never be silently dropped or drift from the rule the
// harness proves. The runtime BEHAVIOR (zod schema + handler wrapping) is proven
// separately by mcp-shared's vitest suite (test/proof.test.ts); this gate owns the
// portable, zero-install invariants.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHARED = join(__dirname, '..', '..', 'runtime', 'mcp-shared', 'src');
const PROOF_SRC = join(SHARED, 'proof', 'index.ts');
const INDEX_SRC = join(SHARED, 'index.ts');

const checks = [];
const ok = (name, cond, detail = '') => {
  checks.push({ name, pass: !!cond, detail });
  return !!cond;
};

// ── the rule, mirrored dependency-free (single source of the decision under test) ──
// Kept byte-for-byte behaviorally equal to evaluateProof() in the runtime helper; the
// drift guard below re-parses the helper's field list to catch divergence.
const REFERENCE_FIELDS = ['triggered', 'observed', 'matches_intent'];
function evaluateProof(proof) {
  if (proof == null || typeof proof !== 'object') return { ok: false, reason: 'missing proof' };
  const triggered = typeof proof.triggered === 'string' ? proof.triggered.trim() : '';
  const observed = typeof proof.observed === 'string' ? proof.observed.trim() : '';
  if (triggered.length < 3) return { ok: false, reason: 'proof.triggered empty' };
  if (observed.length < 3) return { ok: false, reason: 'proof.observed empty' };
  if (proof.matches_intent !== true) return { ok: false, reason: 'proof.matches_intent not true' };
  return { ok: true };
}

const good = { triggered: 'ran pytest -q', observed: '3 passed, exit 0', matches_intent: true };

// ── RED/GREEN on the rule ──────────────────────────────────────────────────────
ok('GREEN: complete matching proof → ok', evaluateProof(good).ok === true);
ok('RED: undefined envelope → refused', evaluateProof(undefined).ok === false);
ok('RED: null envelope → refused', evaluateProof(null).ok === false);
ok('RED: non-object envelope → refused', evaluateProof('nope').ok === false);
ok(
  'RED: whitespace-only triggered → refused',
  evaluateProof({ ...good, triggered: '   ' }).ok === false,
);
ok('RED: too-short triggered → refused', evaluateProof({ ...good, triggered: 'x' }).ok === false);
ok('RED: empty observed → refused', evaluateProof({ ...good, observed: '' }).ok === false);
ok(
  'RED: matches_intent false → refused',
  evaluateProof({ ...good, matches_intent: false }).ok === false,
);
ok(
  'RED: matches_intent missing → refused',
  evaluateProof({ triggered: good.triggered, observed: good.observed }).ok === false,
);
ok(
  'RED: matches_intent truthy-not-true → refused',
  evaluateProof({ ...good, matches_intent: 'yes' }).ok === false,
);
ok(
  'reason names the failing field',
  /observed/.test(evaluateProof({ ...good, observed: '' }).reason || ''),
);

// ── static adoption + wiring scan of the runtime helper ───────────────────────
const hasProof = existsSync(PROOF_SRC);
ok('runtime helper present: mcp-shared/src/proof/index.ts', hasProof, PROOF_SRC);

let proofSrc = '';
let indexSrc = '';
try {
  proofSrc = readFileSync(PROOF_SRC, 'utf8');
} catch {
  /* reported above */
}
try {
  indexSrc = readFileSync(INDEX_SRC, 'utf8');
} catch {
  /* reported below */
}

const EXPORTS = [
  'PROOF_FIELDS',
  'proofObject',
  'proofShape',
  'evaluateProof',
  'proofRefusal',
  'withProof',
];
for (const sym of EXPORTS) {
  ok(
    `helper exports \`${sym}\``,
    new RegExp(`export\\s+(?:const|function|type)\\s+${sym}\\b`).test(proofSrc),
  );
}

ok(
  'helper builds its refusal from the shared results (isError path)',
  /from ['"]\.\.\/results\/index\.js['"]/.test(proofSrc),
);
ok(
  "helper's proof envelope is a zod schema",
  /from ['"]zod['"]/.test(proofSrc) && /z\.object\(/.test(proofSrc),
);
ok(
  'withProof refuses before calling the inner handler',
  /if\s*\(!verdict\.ok\)\s*return\s+proofRefusal/.test(proofSrc),
);

ok('package index re-exports the proof module', /from ['"]\.\/proof\/index\.js['"]/.test(indexSrc));

// ── drift guard: the helper's field list must equal the rule's ────────────────
const m = proofSrc.match(/PROOF_FIELDS\s*=\s*\[([^\]]*)\]/);
const declaredFields = m
  ? m[1]
      .split(',')
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean)
  : [];
ok(
  "PROOF_FIELDS in the helper equals the rule's field triple",
  JSON.stringify(declaredFields) === JSON.stringify(REFERENCE_FIELDS),
  `helper=${JSON.stringify(declaredFields)} rule=${JSON.stringify(REFERENCE_FIELDS)}`,
);

// ── report ────────────────────────────────────────────────────────────────────
const failed = checks.filter((c) => !c.pass);
for (const c of checks)
  if (!c.pass) console.log(`  FAIL ${c.name}${c.detail ? `  [${c.detail}]` : ''}`);
console.log(
  `mcp-proof-params: ${checks.length - failed.length}/${checks.length} selftest checks passed`,
);
process.exit(failed.length ? 1 : 0);
