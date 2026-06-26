#!/usr/bin/env node
// framework/primitives/eval/validate.mjs — validate portable Task/Solver/Scorer
// eval definitions. This proves the contract shape only; executing solvers,
// model-backed judges, and result sinks remain instance-owned.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { compileSchema, formatErrors } from "../_lib/schema.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..", "..", "..");

const schema = JSON.parse(readFileSync(join(__dirname, "eval.schema.json"), "utf8"));
const validateSchema = compileSchema(schema);

export function checkEval(definition) {
  const errors = [];
  if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
    return { errors: ["eval definition is not a JSON object"] };
  }

  if (!validateSchema(definition)) {
    for (const line of formatErrors(validateSchema.errors)) errors.push(line);
  }

  const mode = definition.grading_mode || "deterministic";
  const scorerType = definition.scorer && definition.scorer.type;
  if (scorerType && mode !== scorerType) {
    errors.push(`grading_mode '${mode}' does not match scorer.type '${scorerType}'`);
  }
  if (scorerType === "judge" && !(definition.scorer && definition.scorer.judge_gate)) {
    errors.push("judge scorer requires scorer.judge_gate");
  }
  return { errors };
}

export function validateEvalFile(path) {
  let definition;
  try {
    definition = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    return { path, errors: [`invalid JSON: ${e.message}`] };
  }
  const { errors } = checkEval(definition);
  return { path, errors };
}

function runSelftest() {
  const cases = [
    [
      "accepts a deterministic eval",
      {
        id: "grounded-answer",
        grading_mode: "deterministic",
        task: { id: "grounded-answer", source: "fixtures/grounded-answer.jsonl" },
        solver: { type: "skill", ref: "research" },
        scorer: { type: "deterministic", threshold: 0.95, assertions: ["uses supplied evidence"] },
      },
      (r) => r.errors.length === 0,
    ],
    [
      "accepts a judge eval with gate pointer",
      {
        id: "answer-quality",
        grading_mode: "judge",
        task: { id: "answer-quality", source: "fixtures/answer-quality.jsonl" },
        solver: { type: "agent", ref: "reviewer" },
        scorer: { type: "judge", threshold: 0.8, judge_gate: "standards/eval-harness/judge-gate.json" },
      },
      (r) => r.errors.length === 0,
    ],
    [
      "rejects missing task",
      {
        id: "missing-task",
        solver: { type: "skill", ref: "research" },
        scorer: { type: "deterministic", threshold: 0.9 },
      },
      (r) => r.errors.some((e) => /task|required/.test(e)),
    ],
    [
      "rejects missing solver",
      {
        id: "missing-solver",
        task: { id: "x", source: "fixtures/x.jsonl" },
        scorer: { type: "deterministic", threshold: 0.9 },
      },
      (r) => r.errors.some((e) => /solver|required/.test(e)),
    ],
    [
      "rejects missing scorer",
      {
        id: "missing-scorer",
        task: { id: "x", source: "fixtures/x.jsonl" },
        solver: { type: "skill", ref: "research" },
      },
      (r) => r.errors.some((e) => /scorer|required/.test(e)),
    ],
    [
      "rejects mismatched grading mode",
      {
        id: "mode-mismatch",
        grading_mode: "judge",
        task: { id: "x", source: "fixtures/x.jsonl" },
        solver: { type: "skill", ref: "research" },
        scorer: { type: "deterministic", threshold: 0.9 },
      },
      (r) => r.errors.some((e) => /does not match/.test(e)),
    ],
  ];

  let pass = 0;
  for (const [name, definition, predicate] of cases) {
    const result = checkEval(definition);
    const good = predicate(result);
    if (good) pass++;
    console.log(`  ${good ? "ok  " : "FAIL"} ${name}`);
  }
  console.log(`\neval selftest: ${pass}/${cases.length} passed`);
  return pass === cases.length;
}

if (process.argv[1] && process.argv[1].endsWith("validate.mjs")) {
  const args = process.argv.slice(2);
  if (args.includes("--selftest")) {
    process.exit(runSelftest() ? 0 : 1);
  }

  const targets = args.filter((a) => !a.startsWith("--"));
  let failed = 0;
  for (const t of targets) {
    const { errors } = validateEvalFile(t);
    const rel = t.startsWith(REPO + "/") ? t.slice(REPO.length + 1) : t;
    if (errors.length) {
      failed++;
      console.log(`  FAIL ${rel}`);
      for (const e of errors) console.log(`       x ${e}`);
    } else {
      console.log(`  ok   ${rel}`);
    }
  }

  let selftestOk = true;
  if (targets.length === 0) {
    selftestOk = runSelftest();
  } else {
    console.log(`\neval: ${targets.length - failed}/${targets.length} valid`);
  }
  process.exit(failed || !selftestOk ? 1 : 0);
}
