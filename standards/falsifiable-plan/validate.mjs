#!/usr/bin/env node
// framework/standards/falsifiable-plan/validate.mjs — falsifiable-plan standard.
//
// Enforces the SHAPE of a serialized plan envelope: every load-bearing assertion is
// either discoverable and paired with a falsifying probe, or a preference linked to
// a decision-gate ask. This gate checks structure, not whether the probes are sufficient.
//
// Contract (standard-shape): node shebang, zero npm deps, parseable
// `falsifiable-plan: X/Y selftest checks passed` tail, non-zero exit on failure.
//
// Usage:
//   node validate.mjs                         run the selftest
//   node validate.mjs path/to/plan.json ...   validate plan file(s)
//   node framework/primitives/_lib/validate.mjs --all

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasPersistedRef, hasText, isObject } from '../_lib/shape.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSERTION_CLASSES = new Set(['discoverable', 'preference']);
const STATUSES = new Set(['pending', 'verified']);

function checkAssertion(errors, assertion, index) {
  const at = `assertions[${index}]`;
  if (!isObject(assertion)) {
    errors.push(`${at} is not an object`);
    return;
  }

  if (!hasText(assertion.claim)) errors.push(`${at}.claim is required and non-empty`);
  if (!hasText(assertion.class)) {
    errors.push(`${at}.class is required`);
    return;
  }
  if (!ASSERTION_CLASSES.has(assertion.class)) {
    errors.push(`${at}.class must be discoverable or preference`);
    return;
  }

  if (assertion.status !== undefined && !STATUSES.has(assertion.status)) {
    errors.push(`${at}.status must be pending or verified`);
  }

  if (assertion.class === 'discoverable') {
    if (!hasText(assertion.probe))
      errors.push(`${at}.probe is required for discoverable assertions`);
    if (assertion.status === 'verified') {
      if (!isObject(assertion.evidence) || !hasText(assertion.evidence.ref)) {
        errors.push(`${at}.evidence.ref is required when a discoverable assertion is verified`);
      } else if (!hasPersistedRef(assertion.evidence.ref)) {
        errors.push(
          `${at}.evidence.ref must be path-shaped when a discoverable assertion is verified`,
        );
      }
    }
  }

  if (assertion.class === 'preference') {
    if (!hasText(assertion.decision_id))
      errors.push(`${at}.decision_id is required for preference assertions`);
    if (assertion.status === 'verified') {
      errors.push(
        `${at}.status cannot be verified for preference assertions; preferences are operator-ratified`,
      );
    }
  }
}

function checkAcceptance(errors, acceptance) {
  if (!Array.isArray(acceptance) || acceptance.length === 0) {
    errors.push('acceptance must be a non-empty array');
    return;
  }
  acceptance.forEach((entry, index) => {
    const at = `acceptance[${index}]`;
    if (!isObject(entry)) {
      errors.push(`${at} is not an object`);
      return;
    }
    if (!hasText(entry.criterion)) errors.push(`${at}.criterion is required and non-empty`);
    if (!hasText(entry.check)) errors.push(`${at}.check is required and non-empty`);
  });
}

export function checkPlan(plan) {
  const errors = [];
  if (!isObject(plan)) return ['plan is not an object'];
  if (plan.kind !== 'plan') errors.push('kind must be "plan"');
  if (!hasText(plan.id)) errors.push('id is required and non-empty');
  if (!hasText(plan.objective)) errors.push('objective is required and non-empty');

  if (!Array.isArray(plan.assertions) || plan.assertions.length === 0) {
    errors.push('assertions must be a non-empty array');
  } else {
    plan.assertions.forEach((assertion, index) => checkAssertion(errors, assertion, index));
  }

  checkAcceptance(errors, plan.acceptance);
  return errors;
}

const GOOD = {
  kind: 'plan',
  id: 'portable-cache-plan',
  objective: 'Add a portable cache manifest check before enabling the runtime path.',
  assertions: [
    {
      claim: 'The manifest checker runs without package installation.',
      class: 'discoverable',
      probe: 'node framework/standards/cache-manifest/validate.mjs',
      status: 'verified',
      evidence: { ref: 'reports/cache-manifest-selftest.txt' },
    },
    {
      claim: 'The runtime path has no pending migration note.',
      class: 'discoverable',
      probe: 'rg -n "TODO|MIGRATION" framework/runtime/cache',
      status: 'pending',
    },
    {
      claim: 'The rollout posture must be chosen by the operator.',
      class: 'preference',
      decision_id: 'D1-rollout-posture',
    },
  ],
  acceptance: [
    {
      criterion: 'Validator accepts the good envelope',
      check: 'node framework/standards/falsifiable-plan/validate.mjs example-plan.json',
    },
    {
      criterion: 'Full harness discovers the standard',
      check: 'node framework/primitives/_lib/validate.mjs --all',
    },
  ],
};

const checks = [];
const ok = (name, cond, detail = '') => {
  checks.push({ name, pass: !!cond, detail });
  return !!cond;
};
const withPlan = (patch) => ({ ...GOOD, ...patch });
const withAssertion = (patch) => withPlan({ assertions: [{ ...GOOD.assertions[0], ...patch }] });
const withPreference = (patch) => withPlan({ assertions: [{ ...GOOD.assertions[2], ...patch }] });

ok('accepts a full valid plan', checkPlan(GOOD).length === 0);
ok(
  'rejects a non-object',
  checkPlan(null).some((e) => /not an object/.test(e)),
);
ok(
  'rejects the wrong kind',
  checkPlan(withPlan({ kind: 'task' })).some((e) => /kind/.test(e)),
);
ok(
  'rejects a missing id',
  checkPlan(withPlan({ id: '  ' })).some((e) => /id/.test(e)),
);
ok(
  'rejects a missing objective',
  checkPlan(withPlan({ objective: '' })).some((e) => /objective/.test(e)),
);
ok(
  'rejects missing assertions',
  checkPlan(withPlan({ assertions: [] })).some((e) => /assertions/.test(e)),
);
ok(
  'rejects an assertion missing claim',
  checkPlan(withAssertion({ claim: '' })).some((e) => /claim/.test(e)),
);
ok(
  'rejects an assertion missing class',
  checkPlan(withAssertion({ class: '' })).some((e) => /class is required/.test(e)),
);
ok(
  'rejects an invalid assertion class',
  checkPlan(withAssertion({ class: 'guess' })).some((e) => /class must/.test(e)),
);
ok(
  'rejects discoverable assertion without probe',
  checkPlan(withAssertion({ probe: '' })).some((e) => /probe/.test(e)),
);
ok(
  'rejects verified discoverable assertion without evidence ref',
  checkPlan(withAssertion({ evidence: {} })).some((e) => /evidence.ref is required/.test(e)),
);
ok(
  'rejects verified discoverable assertion with non-path evidence ref',
  checkPlan(withAssertion({ evidence: { ref: 'plainref' } })).some((e) => /path-shaped/.test(e)),
);
ok(
  'rejects an invalid status',
  checkPlan(withAssertion({ status: 'done' })).some((e) => /status must/.test(e)),
);
ok(
  'rejects preference assertion without decision id',
  checkPlan(withPreference({ decision_id: '' })).some((e) => /decision_id/.test(e)),
);
ok(
  'rejects verified preference assertion',
  checkPlan(withPreference({ status: 'verified' })).some((e) => /operator-ratified/.test(e)),
);
ok(
  'accepts preference assertion carrying harmless probe and evidence',
  checkPlan(withPreference({ probe: 'cat notes.md', evidence: { ref: 'notes.md' } })).length === 0,
);
ok(
  'rejects missing acceptance',
  checkPlan(withPlan({ acceptance: [] })).some((e) => /acceptance/.test(e)),
);
ok(
  'rejects acceptance entry without criterion/check',
  checkPlan(withPlan({ acceptance: [{ criterion: '', check: '' }] })).filter((e) =>
    /acceptance\[0\]/.test(e),
  ).length === 2,
);
ok('file present: README.md', existsSync(join(__dirname, 'README.md')));
try {
  const example = JSON.parse(readFileSync(join(__dirname, 'example-plan.json'), 'utf8'));
  ok('example-plan.json validates', checkPlan(example).length === 0);
} catch (e) {
  ok('example-plan.json validates', false, e.message);
}

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
let fileFailures = 0;
for (const arg of args) {
  try {
    const parsed = JSON.parse(readFileSync(arg, 'utf8'));
    const errors = checkPlan(parsed);
    if (errors.length) {
      fileFailures++;
      console.log(`  FAIL ${arg}`);
      for (const e of errors) console.log(`       x ${e}`);
    } else {
      console.log(`  ok   ${arg}`);
    }
  } catch (e) {
    fileFailures++;
    console.log(`  FAIL ${arg}`);
    console.log(`       x invalid JSON: ${e.message}`);
  }
}
if (args.length) process.exit(fileFailures ? 1 : 0);

const failed = checks.filter((c) => !c.pass);
for (const c of failed) console.log(`  FAIL ${c.name}${c.detail ? `  [${c.detail}]` : ''}`);
console.log(
  `falsifiable-plan: ${checks.length - failed.length}/${checks.length} selftest checks passed`,
);
process.exit(failed.length ? 1 : 0);
