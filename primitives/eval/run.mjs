#!/usr/bin/env node
// run.mjs — deterministic runner for the eval primitive. It executes only local,
// fixture-backed deterministic evals. Judge-mode execution remains instance-owned.

import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkEval } from './validate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseJsonOrJsonl(text, sourcePath) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error(`${sourcePath}: source is empty`);
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed);
    } catch (err) {
      if (!/Unexpected non-whitespace character after JSON/.test(err.message)) throw err;
    }
  }
  return trimmed
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, i) => {
      try {
        return JSON.parse(line);
      } catch (err) {
        throw new Error(`${sourcePath}:${i + 1}: invalid JSONL: ${err.message}`);
      }
    });
}

function normalizeCases(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (isObject(parsed) && Array.isArray(parsed.cases)) return parsed.cases;
  if (isObject(parsed)) return [parsed];
  throw new Error('source must be a JSON object, JSON array, or JSONL rows');
}

function localSourcePath(evalPath, source) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(source)) {
    throw new Error('deterministic runner only supports local file sources');
  }
  return isAbsolute(source) ? source : resolve(dirname(evalPath), source);
}

function loadCases(evalPath, source) {
  const sourcePath = localSourcePath(evalPath, source);
  const parsed = parseJsonOrJsonl(readFileSync(sourcePath, 'utf8'), sourcePath);
  return normalizeCases(parsed).map((item, index) => {
    if (!isObject(item)) throw new Error(`case ${index} is not an object`);
    const output = item.output ?? item.actual ?? item.response;
    if (typeof output !== 'string')
      throw new Error(`case ${index} missing string output/actual/response`);
    return {
      id: typeof item.id === 'string' && item.id ? item.id : `case-${index + 1}`,
      output,
    };
  });
}

function parseAssertion(raw) {
  const text = String(raw);
  if (text.startsWith('contains:'))
    return { type: 'contains', value: text.slice('contains:'.length).trim() };
  if (text.startsWith('not_contains:'))
    return { type: 'not_contains', value: text.slice('not_contains:'.length).trim() };
  if (text.startsWith('regex:')) {
    const value = text.slice('regex:'.length).trim();
    const m = value.match(/^\/(.*)\/([a-z]*)$/i);
    return m ? { type: 'regex', value: m[1], flags: m[2] } : { type: 'regex', value, flags: '' };
  }
  return { type: 'contains', value: text.trim() };
}

function assertionPasses(assertion, output) {
  if (assertion.type === 'contains') return output.includes(assertion.value);
  if (assertion.type === 'not_contains') return !output.includes(assertion.value);
  if (assertion.type === 'regex') return new RegExp(assertion.value, assertion.flags).test(output);
  return false;
}

export function runDeterministicEval(definition, evalPath, now = new Date()) {
  const assertions = Array.isArray(definition.scorer.assertions)
    ? definition.scorer.assertions.map(parseAssertion)
    : [];
  if (assertions.length === 0) throw new Error('deterministic scorer requires scorer.assertions');

  const cases = loadCases(evalPath, definition.task.source);
  let passedAssertions = 0;
  const totalAssertions = cases.length * assertions.length;
  const results = cases.map((testCase) => {
    const checks = assertions.map((assertion, index) => {
      const pass = assertionPasses(assertion, testCase.output);
      if (pass) passedAssertions++;
      return { index, type: assertion.type, pass };
    });
    return {
      id: testCase.id,
      passed: checks.filter((c) => c.pass).length,
      failed: checks.filter((c) => !c.pass).length,
      checks,
    };
  });
  const score = totalAssertions ? passedAssertions / totalAssertions : 0;
  const pass = score >= definition.scorer.threshold;
  const generatedAt = now.toISOString();
  return {
    eval_id: definition.id,
    task_id: definition.task.id,
    solver: definition.solver,
    scorer_type: 'deterministic',
    gradeable: true,
    pass,
    score,
    threshold: definition.scorer.threshold,
    cases: cases.length,
    assertions: assertions.length,
    generated_at: generatedAt,
    results,
    run_record: {
      ts: generatedAt,
      task_id: definition.task.id,
      slice: `eval:${definition.id}`,
      verify: { first_pass: pass, result: pass ? 'pass' : 'fail' },
      metadata: {
        eval_id: definition.id,
        solver_type: definition.solver.type,
        solver_ref: definition.solver.ref,
        gradeable: true,
        score,
        threshold: definition.scorer.threshold,
      },
    },
  };
}

export function runEvalFile(path, now = new Date()) {
  const definition = JSON.parse(readFileSync(path, 'utf8'));
  const { errors } = checkEval(definition);
  if (errors.length) throw new Error(errors.join('; '));
  const mode = definition.grading_mode || 'deterministic';
  if (mode === 'judge') {
    return {
      eval_id: definition.id,
      task_id: definition.task.id,
      solver: definition.solver,
      scorer_type: 'judge',
      gradeable: false,
      pass: null,
      score: null,
      threshold: definition.scorer.threshold,
      generated_at: now.toISOString(),
      skipped_reason: 'judge scorer requires an instance-owned judge runner',
      run_record: null,
    };
  }
  return runDeterministicEval(definition, path, now);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(join(__dirname, 'run.mjs'))) {
  const target = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (!target) {
    console.error('usage: node framework/primitives/eval/run.mjs <eval.json>');
    process.exit(2);
  }
  try {
    console.log(JSON.stringify(runEvalFile(resolve(target)), null, 2));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
