#!/usr/bin/env node
// framework/standards/decision-gate/validate.mjs — decision-gate standard.
//
// Enforces the SHAPE of a "decision-ask": the single, batched question an orchestrator puts to
// the operator when several preferences are genuinely unresolved. The checked contract:
//   • kind === "decision-ask"
//   • decisions is a non-empty array of AT MOST 4 items (one batched ask, not a drip)
//   • each item: a non-empty question; 2–4 unique non-empty options; a recommendation that is
//     one of those options (the "marked recommendation")
//   • item ids, when present, are unique
//
// The CLASSIFICATION law — is an unknown discoverable (find it, never ask) or a preference (ask
// once) — lives in framework/doctrine/rules/decision-making.md; this gate does NOT classify.
// This gate enforces the ask's shape; whether a question should have been asked at all is scored
// behaviorally by the trajectory-eval standard (question_economy + question_discoverability),
// not here. A decision-ask is the operator-facing counterpart to a worker brief
// (framework/primitives/worker-brief/): a brief goes down to a worker, an ask goes up to the operator.
//
// Contract (standard-shape): node shebang, ZERO npm deps (node: builtins + relative only), a
// parseable `decision-gate: X/Y selftest checks passed` tail, non-zero exit on failure.
//
// Usage:
//   node validate.mjs                       run the selftest
//   node validate.mjs path/to/ask.json ...  validate decision-ask file(s)
//   node framework/primitives/_lib/validate.mjs --all

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const MAX_DECISIONS = 4;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 4;
const OPERATOR_BASES = new Set(["operator", "operator-turn", "operator-answer"]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasResolutionValue(value) {
  return value !== undefined && value !== null && value !== false;
}

function allowedResolutionBasis(basis) {
  if (typeof basis !== "string" || basis.trim() === "") return false;
  const normalized = basis.trim();
  return OPERATOR_BASES.has(normalized) || /^precedent:[A-Za-z0-9_.:-]+$/.test(normalized);
}

function checkResolutionBasis(errors, at, basis) {
  if (basis === undefined || basis === null || String(basis).trim() === "") {
    errors.push(`${at}.basis is required; absent basis with resolution present is self-ratification`);
  } else if (!allowedResolutionBasis(basis)) {
    errors.push(`${at}.basis "${basis}" is self-ratification; use operator-turn/operator/operator-answer or precedent:<decision-id>`);
  }
}

function resolutionBasis(owner, field) {
  const value = owner[field];
  if (!hasResolutionValue(value)) return { present: false };
  if (isObject(value) && Object.prototype.hasOwnProperty.call(value, "basis")) {
    return { present: true, basis: value.basis, at: field };
  }
  for (const key of [`${field}_basis`, "resolution_basis", "basis"]) {
    if (Object.prototype.hasOwnProperty.call(owner, key)) return { present: true, basis: owner[key], at: field };
  }
  return { present: true, basis: undefined, at: field };
}

function checkDecisionResolution(errors, decision, at) {
  for (const field of ["resolution", "resolved"]) {
    const resolution = resolutionBasis(decision, field);
    if (resolution.present) checkResolutionBasis(errors, `${at}.${resolution.at}`, resolution.basis);
  }
}

function checkTopLevelResolution(errors, resolution) {
  const nested = Object.entries(resolution).filter(([key, value]) => key !== "basis" && isObject(value) && Object.prototype.hasOwnProperty.call(value, "basis"));
  if (Object.prototype.hasOwnProperty.call(resolution, "basis")) {
    checkResolutionBasis(errors, "resolution", resolution.basis);
  } else if (nested.length === 0) {
    checkResolutionBasis(errors, "resolution", undefined);
  }
  for (const [key, value] of nested) checkResolutionBasis(errors, `resolution.${key}`, value.basis);
}

// checkDecisionAsk(doc) -> string[] of errors ([] means valid).
export function checkDecisionAsk(doc) {
  const errors = [];
  if (!isObject(doc)) {
    return ["decision-ask is not an object"];
  }
  if (doc.kind !== "decision-ask") errors.push('kind must be "decision-ask"');

  const decisions = doc.decisions;
  if (!Array.isArray(decisions) || decisions.length === 0) {
    errors.push("decisions must be a non-empty array");
    return errors;
  }
  if (decisions.length > MAX_DECISIONS) {
    errors.push(`decisions has ${decisions.length} items; a batched ask carries at most ${MAX_DECISIONS}`);
  }

  const seenIds = new Set();
  decisions.forEach((d, i) => {
    const at = `decisions[${i}]`;
    if (!isObject(d)) {
      errors.push(`${at} is not an object`);
      return;
    }
    if (typeof d.question !== "string" || d.question.trim() === "") {
      errors.push(`${at}.question is required and non-empty`);
    }

    const opts = d.options;
    let optsOk = false;
    if (!Array.isArray(opts) || opts.length < MIN_OPTIONS || opts.length > MAX_OPTIONS) {
      errors.push(`${at}.options must have ${MIN_OPTIONS}–${MAX_OPTIONS} items`);
    } else if (opts.some((o) => typeof o !== "string" || o.trim() === "")) {
      errors.push(`${at}.options must all be non-empty strings`);
    } else if (new Set(opts).size !== opts.length) {
      errors.push(`${at}.options must be unique`);
    } else {
      optsOk = true;
    }

    if (typeof d.recommendation !== "string" || d.recommendation.trim() === "") {
      errors.push(`${at}.recommendation is required (mark the recommended option)`);
    } else if (optsOk && !opts.includes(d.recommendation)) {
      errors.push(`${at}.recommendation must be one of options`);
    }

    if (d.id !== undefined) {
      if (typeof d.id !== "string" || d.id.trim() === "") {
        errors.push(`${at}.id, when present, must be a non-empty string`);
      } else if (seenIds.has(d.id)) {
        errors.push(`${at}.id "${d.id}" is duplicated`);
      } else {
        seenIds.add(d.id);
      }
    }
    checkDecisionResolution(errors, d, at);
  });

  if (doc.resolution !== undefined) {
    if (!isObject(doc.resolution)) {
      errors.push("resolution, when present, must be an object");
    } else {
      checkTopLevelResolution(errors, doc.resolution);
    }
  }
  return errors;
}

// ── selftest: prove the checker accepts a good ask and rejects each malformation ──
const checks = [];
const ok = (name, cond, detail = "") => { checks.push({ name, pass: !!cond, detail }); return !!cond; };

const GOOD = {
  kind: "decision-ask",
  decisions: [
    { id: "D1", question: "Which store backs the session cache?", options: ["Redis", "in-memory", "Postgres"], recommendation: "Redis", rationale: "shared across nodes, native TTL" },
    { id: "D2", question: "Fail open or fail closed when the cache is unreachable?", options: ["fail open", "fail closed"], recommendation: "fail open" },
    { id: "D3", question: "Ship the migration now or behind a flag?", options: ["now", "behind a flag"], recommendation: "behind a flag" },
  ],
};

const one = (decision) => ({ kind: "decision-ask", decisions: [decision] });
const OPERATOR_RATIFIED = {
  kind: "decision-ask",
  decisions: GOOD.decisions,
  resolution: {
    D1: "Redis",
    D2: "fail open",
    D3: "behind a flag",
    basis: "operator-turn",
  },
};
const SELF_RATIFIED = {
  kind: "decision-ask",
  decisions: [
    { id: "D1", question: "Exposure posture for the working copy?", options: ["enable-in-working-copy", "leave-dark"], recommendation: "enable-in-working-copy" },
  ],
  resolution: {
    D1: "enable-in-working-copy",
    basis: "task-directive",
  },
};

ok("accepts a well-formed 3-fork batched ask", checkDecisionAsk(GOOD).length === 0);
ok("accepts a single-fork ask", checkDecisionAsk(one({ question: "A or B?", options: ["A", "B"], recommendation: "A" })).length === 0);
ok("accepts an ask without ids", checkDecisionAsk({ kind: "decision-ask", decisions: [{ question: "A or B?", options: ["A", "B"], recommendation: "B" }] }).length === 0);
ok("accepts an operator-ratified resolution", checkDecisionAsk(OPERATOR_RATIFIED).length === 0);

ok("rejects a non-object", checkDecisionAsk(null).some((e) => /not an object/.test(e)));
ok("rejects the wrong kind", checkDecisionAsk({ kind: "brief", decisions: GOOD.decisions }).some((e) => /kind/.test(e)));
ok("rejects an empty decisions array", checkDecisionAsk({ kind: "decision-ask", decisions: [] }).some((e) => /non-empty array/.test(e)));
ok("rejects more than four forks", checkDecisionAsk({ kind: "decision-ask", decisions: [1, 2, 3, 4, 5].map((n) => ({ question: `q${n}?`, options: ["a", "b"], recommendation: "a" })) }).some((e) => /at most 4/.test(e)));
ok("rejects a single-option fork", checkDecisionAsk(one({ question: "only one?", options: ["only"], recommendation: "only" })).some((e) => /options must have/.test(e)));
ok("rejects more than four options", checkDecisionAsk(one({ question: "too many?", options: ["a", "b", "c", "d", "e"], recommendation: "a" })).some((e) => /options must have/.test(e)));
ok("rejects a missing recommendation", checkDecisionAsk(one({ question: "which?", options: ["a", "b"] })).some((e) => /recommendation is required/.test(e)));
ok("rejects a recommendation not among the options", checkDecisionAsk(one({ question: "which?", options: ["a", "b"], recommendation: "c" })).some((e) => /must be one of options/.test(e)));
ok("rejects duplicate option labels", checkDecisionAsk(one({ question: "which?", options: ["a", "a"], recommendation: "a" })).some((e) => /unique/.test(e)));
ok("rejects an empty question", checkDecisionAsk(one({ question: "  ", options: ["a", "b"], recommendation: "a" })).some((e) => /question is required/.test(e)));
ok("rejects duplicate ids", checkDecisionAsk({ kind: "decision-ask", decisions: [{ id: "X", question: "q1?", options: ["a", "b"], recommendation: "a" }, { id: "X", question: "q2?", options: ["a", "b"], recommendation: "b" }] }).some((e) => /duplicated/.test(e)));
ok("rejects a self-ratified resolution", checkDecisionAsk(SELF_RATIFIED).some((e) => /self-ratification/.test(e)));

ok("file present: README.md", existsSync(join(__dirname, "README.md")));

// ── CLI: validate decision-ask file(s) passed as args; selftest otherwise ──
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
let fileFailures = 0;
for (const arg of args) {
  try {
    const parsed = JSON.parse(readFileSync(arg, "utf8"));
    const errors = checkDecisionAsk(parsed);
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
for (const c of failed) console.log(`  FAIL ${c.name}${c.detail ? `  [${c.detail}]` : ""}`);
console.log(`decision-gate: ${checks.length - failed.length}/${checks.length} selftest checks passed`);
process.exit(failed.length ? 1 : 0);
