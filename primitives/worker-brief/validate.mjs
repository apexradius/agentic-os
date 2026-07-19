#!/usr/bin/env node
// framework/primitives/worker-brief/validate.mjs — validate worker briefs and returns.
//
//   node validate.mjs                 run the RED/GREEN selftest (no durable corpus — briefs are
//                                     composed per dispatch; the selftest is the standalone proof)
//   node validate.mjs <file.json> ... validate specific brief/return documents
//
// The schema (ajv) is the build-time authority; render.mjs carries the light dispatch-time twin.
// This selftest proves the two agree and that render's field allowlist has not drifted from the schema.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { formatErrors, makeAjv } from '../_lib/schema.mjs';
import { RETURN_FIELDS, renderBrief, validateReturn } from './render.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..', '..', '..');

const schema = JSON.parse(readFileSync(join(__dirname, 'worker-brief.schema.json'), 'utf8'));
const ID = schema.$id;
const ajv = makeAjv();
ajv.addSchema(schema);
const validateBrief = ajv.compile({ $ref: `${ID}#/$defs/brief` });
const validateReturnDoc = ajv.compile({ $ref: `${ID}#/$defs/return` });

export function checkBrief(doc) {
  const errors = [];
  if (!validateBrief(doc)) for (const line of formatErrors(validateBrief.errors)) errors.push(line);
  return { errors };
}

export function checkReturn(doc, contract) {
  const errors = [];
  if (!validateReturnDoc(doc))
    for (const line of formatErrors(validateReturnDoc.errors)) errors.push(line);
  // Dynamic cap: JSON-Schema maxLength is static, but the cap is declared per-brief. Enforce the
  // tighter contract cap in code when a contract is supplied.
  if (
    contract &&
    typeof contract.summary_max_chars === 'number' &&
    typeof doc.summary === 'string'
  ) {
    if (doc.summary.length > contract.summary_max_chars) {
      errors.push(
        `summary is ${doc.summary.length} chars, over the declared cap of ${contract.summary_max_chars}`,
      );
    }
  }
  return { errors };
}

export function checkDoc(doc, contract) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc))
    return { errors: ['document is not a JSON object'] };
  if (doc.kind === 'brief') return checkBrief(doc);
  if (doc.kind === 'return') return checkReturn(doc, contract);
  return { errors: [`unknown kind ${JSON.stringify(doc.kind)} — must be "brief" or "return"`] };
}

export function validateBriefFile(path) {
  let doc;
  try {
    doc = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    return { path, errors: [`invalid JSON: ${e.message}`] };
  }
  return { path, ...checkDoc(doc) };
}

// ── selftest fixtures (inline; briefs are ephemeral so there is no on-disk corpus) ──
const GOOD_CONTRACT = {
  required_fields: ['summary', 'evidence', 'status'],
  summary_max_chars: 2000,
};
const GOOD_BRIEF = {
  kind: 'brief',
  objective: 'Add a timeout parameter to the fetchData() helper and thread it to the fetch call.',
  inputs: [
    'src/net/fetchData.js holds the helper',
    'one caller in src/app.js',
    'existing tests in test/net.test.js',
  ],
  constraints: [
    'do NOT touch the retry layer',
    'keep the default behavior unchanged when the param is omitted',
  ],
  stance:
    'Verify before reporting: run the test suite and show the output; flag any deviation rather than absorbing it.',
  verify_bar: 'npm test -- net passes, and the new default-omitted path is covered by a test.',
  return_contract: GOOD_CONTRACT,
  tool_guidance: 'Prefer Edit over rewrite; run the suite with npm test.',
  hold_point: 'Hand back after tests pass — do not commit.',
  plan_anchor: 'slice-7.2-example',
  questions: ['did any caller rely on the old signature?'],
  deviation_policy: 'Flag it, do not silently absorb.',
};
const GOOD_RETURN = {
  kind: 'return',
  status: 'done',
  summary:
    'Added an optional timeout param defaulting to the prior behavior; threaded to fetch; added a test for the omitted-param path.',
  evidence: ['npm test -- net -> 14 passed', 'src/net/fetchData.js:12 new param'],
  deviations: [],
  fence_respected: true,
  artifacts: ['src/net/fetchData.js', 'test/net.test.js'],
};

function runSelftest() {
  const checks = [];
  const ok = (name, cond, detail = '') => {
    checks.push([name, !!cond, detail]);
    return !!cond;
  };
  const drop = (obj, key) => {
    const c = structuredClone(obj);
    delete c[key];
    return c;
  };

  ok(
    'accepts a good brief',
    checkDoc(GOOD_BRIEF).errors.length === 0,
    JSON.stringify(checkDoc(GOOD_BRIEF).errors),
  );
  ok('accepts a good return (no contract)', checkDoc(GOOD_RETURN).errors.length === 0);
  ok(
    'accepts a good return under the declared cap',
    checkDoc(GOOD_RETURN, GOOD_CONTRACT).errors.length === 0,
  );

  ok('rejects a brief missing stance', checkDoc(drop(GOOD_BRIEF, 'stance')).errors.length > 0);
  ok(
    'rejects a brief missing constraints',
    checkDoc(drop(GOOD_BRIEF, 'constraints')).errors.length > 0,
  );
  ok(
    'rejects a brief missing return_contract',
    checkDoc(drop(GOOD_BRIEF, 'return_contract')).errors.length > 0,
  );
  ok(
    'rejects a brief missing verify_bar',
    checkDoc(drop(GOOD_BRIEF, 'verify_bar')).errors.length > 0,
  );
  ok(
    "rejects a return_contract whose required_fields omits 'summary'",
    checkDoc({
      ...GOOD_BRIEF,
      return_contract: { required_fields: ['evidence'], summary_max_chars: 2000 },
    }).errors.length > 0,
  );

  const withTrajectory = { ...GOOD_RETURN, trajectory: [{ step: 'read a file' }] };
  ok(
    'rejects a return carrying a trajectory field (summary-only by omission)',
    checkDoc(withTrajectory).errors.length > 0,
  );

  const overCap = { ...GOOD_RETURN, summary: 'x'.repeat(300) };
  ok(
    'rejects a return whose summary exceeds the declared cap',
    checkDoc(overCap, { required_fields: ['summary'], summary_max_chars: 200 }).errors.length > 0,
  );

  ok(
    'rejects an unknown kind',
    checkDoc({ kind: 'note', body: 'x' }).errors.some((e) => /unknown kind/.test(e)),
  );

  // render round-trip
  const prompt = renderBrief(GOOD_BRIEF);
  ok(
    'render: produces prompt text with the objective and verify bar',
    typeof prompt === 'string' &&
      prompt.includes('Add a timeout parameter') &&
      prompt.includes('Verify bar'),
  );
  ok('render: states the char cap in the prompt', prompt.includes('2000 characters'));

  // drift guard: render's return allowlist must match the schema's return envelope exactly
  const schemaReturnFields = Object.keys(schema.$defs.return.properties);
  ok(
    'drift: render.RETURN_FIELDS matches worker-brief.schema.json $defs.return',
    JSON.stringify([...RETURN_FIELDS].sort()) === JSON.stringify(schemaReturnFields.sort()),
    `render=${RETURN_FIELDS} schema=${schemaReturnFields}`,
  );

  // render.validateReturn (dispatch-time twin) agrees with the ajv authority
  ok(
    'twin: render.validateReturn rejects the trajectory field like ajv does',
    validateReturn(withTrajectory, GOOD_CONTRACT).ok === false,
  );
  ok(
    'twin: render.validateReturn rejects over-cap like ajv does',
    validateReturn(overCap, { summary_max_chars: 200 }).ok === false,
  );
  ok(
    'twin: render.validateReturn accepts the good return',
    validateReturn(GOOD_RETURN, GOOD_CONTRACT).ok === true,
  );

  let pass = 0;
  for (const [name, good, detail] of checks) {
    if (good) pass++;
    console.log(`  ${good ? 'ok  ' : 'FAIL'} ${name}${!good && detail ? `  [${detail}]` : ''}`);
  }
  console.log(`\nworker-brief selftest: ${pass}/${checks.length} passed`);
  return pass === checks.length;
}

if (process.argv[1] && process.argv[1].endsWith('validate.mjs')) {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) process.exit(runSelftest() ? 0 : 1);

  const targets = args.filter((a) => !a.startsWith('--'));
  let failed = 0;
  for (const t of targets) {
    const { errors } = validateBriefFile(t);
    const rel = t.startsWith(REPO + '/') ? t.slice(REPO.length + 1) : t;
    if (errors.length) {
      failed++;
      console.log(`  FAIL ${rel}`);
      for (const e of errors) console.log(`       x ${e}`);
    } else {
      console.log(`  ok   ${rel}`);
    }
  }

  let selftestOk = true;
  if (targets.length === 0) selftestOk = runSelftest();
  else console.log(`\nworker-brief: ${targets.length - failed}/${targets.length} valid`);
  process.exit(failed || !selftestOk ? 1 : 0);
}
