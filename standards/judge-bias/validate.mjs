#!/usr/bin/env node
// validate.mjs — the judge-bias standard. Enforces doctrine/standards/judge-bias.md:
// model-judged gates must declare deterministic-first routing, order-swap agreement,
// judge separation, and rubric controls for known verbosity/self-preference bias.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", ".."); // framework/
const checks = [];
const ok = (name, cond, detail = "") => { checks.push({ name, pass: !!cond, detail }); return !!cond; };

export function validateJudgeGate(gate) {
  const errors = [];
  if (!gate || typeof gate !== "object" || Array.isArray(gate)) return ["manifest must be an object"];
  if (typeof gate.id !== "string" || !gate.id.trim()) errors.push("id is required");
  if (gate.deterministic_first !== true) errors.push("deterministic_first must be true");
  if (!gate.order_swap || gate.order_swap.enabled !== true) errors.push("order_swap.enabled must be true");
  if (!gate.order_swap || gate.order_swap.require_consistent_verdict !== true) {
    errors.push("order_swap.require_consistent_verdict must be true");
  }
  if (!gate.agreement || gate.agreement.required !== true) errors.push("agreement.required must be true");
  if (!gate.judge_separation || typeof gate.judge_separation.policy !== "string" || !gate.judge_separation.policy.trim()) {
    errors.push("judge_separation.policy is required");
  }
  const controls = Array.isArray(gate.rubric_controls) ? gate.rubric_controls : [];
  for (const required of ["verbosity-neutral", "self-preference-neutral"]) {
    if (!controls.includes(required)) errors.push(`rubric_controls must include ${required}`);
  }
  return errors;
}

function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name === "judge-gate.json") acc.push(p);
  }
  return acc;
}

const good = {
  id: "good",
  deterministic_first: true,
  order_swap: { enabled: true, require_consistent_verdict: true },
  agreement: { required: true, on_disagreement: "escalate" },
  judge_separation: { policy: "different-model-preferred", fallback: "record-reason" },
  rubric_controls: ["verbosity-neutral", "self-preference-neutral"],
};
const missingSwap = { ...good, order_swap: { enabled: false, require_consistent_verdict: false } };
const missingControls = { ...good, rubric_controls: ["verbosity-neutral"] };

ok("validateJudgeGate: accepts a fully controlled judge gate", validateJudgeGate(good).length === 0);
ok("validateJudgeGate: rejects missing order-swap controls", validateJudgeGate(missingSwap).some((e) => e.includes("order_swap")));
ok("validateJudgeGate: rejects missing self-preference control", validateJudgeGate(missingControls).some((e) => e.includes("self-preference")));

const manifests = walk(join(ROOT, "standards"));
ok("scan: at least one real judge-gate manifest exists", manifests.length > 0, "expected a standards/*/judge-gate.json");
let firstBad = "";
for (const f of manifests) {
  try {
    const errors = validateJudgeGate(JSON.parse(readFileSync(f, "utf8")));
    if (errors.length && !firstBad) firstBad = `${f.slice(ROOT.length + 1)}: ${errors.join("; ")}`;
  } catch (err) {
    if (!firstBad) firstBad = `${f.slice(ROOT.length + 1)}: ${err.message}`;
  }
}
ok("scan: every real judge-gate manifest declares bias controls", firstBad === "", firstBad);

for (const f of ["validate.mjs", "README.md"]) ok(`file present: ${f}`, existsSync(join(__dirname, f)));

const failed = checks.filter((c) => !c.pass);
for (const c of checks) if (!c.pass) console.log(`  FAIL ${c.name}${c.detail ? `  [${c.detail}]` : ""}`);
console.log(`judge-bias: ${checks.length - failed.length}/${checks.length} selftest checks passed`);
process.exit(failed.length ? 1 : 0);
