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

function validateReplay(replay) {
  const errors = [];
  if (!replay || typeof replay !== "object" || Array.isArray(replay)) return ["replay must be an object"];
  if (typeof replay.id !== "string" || !replay.id.trim()) errors.push("id is required");
  if (typeof replay.gate_id !== "string" || !replay.gate_id.trim()) errors.push("gate_id is required");
  for (const side of ["original", "swapped"]) {
    const item = replay[side];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push(`${side} is required`);
      continue;
    }
    if (!["pass", "fail"].includes(item.verdict)) errors.push(`${side}.verdict must be pass or fail`);
    if (typeof item.presentation !== "string" || !item.presentation.trim()) errors.push(`${side}.presentation is required`);
  }
  if (typeof replay.consistent !== "boolean") errors.push("consistent must be boolean");
  if (replay.original && replay.swapped && typeof replay.consistent === "boolean") {
    const computed = replay.original.verdict === replay.swapped.verdict;
    if (computed !== replay.consistent) errors.push("consistent must match original/swapped verdict agreement");
    if (!computed) {
      const esc = replay.escalation;
      if (!esc || typeof esc !== "object" || Array.isArray(esc)) {
        errors.push("escalation is required when swapped verdicts disagree");
      } else {
        if (esc.required !== true) errors.push("escalation.required must be true when swapped verdicts disagree");
        if (!["escalated", "recorded"].includes(esc.state)) {
          errors.push("escalation.state must be escalated or recorded when swapped verdicts disagree");
        }
      }
    }
  }
  return errors;
}

function walkNamed(dir, name, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walkNamed(p, name, acc);
    else if (e.name === name) acc.push(p);
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
const replayGood = {
  id: "good-replay",
  gate_id: "good",
  original: { presentation: "candidate-a-first", verdict: "pass" },
  swapped: { presentation: "candidate-b-first", verdict: "pass" },
  consistent: true,
  escalation: { required: false, state: "not-needed" },
  gold_set: { id: "gold", labels: ["pass", "fail"], ratings_count: 4 },
};
const replayDisagreementNoEscalation = {
  ...replayGood,
  id: "bad-replay",
  original: { presentation: "candidate-a-first", verdict: "pass" },
  swapped: { presentation: "candidate-b-first", verdict: "fail" },
  consistent: false,
  escalation: { required: false, state: "not-needed" },
};
const replayDisagreementEscalated = {
  ...replayDisagreementNoEscalation,
  escalation: { required: true, state: "recorded" },
};

ok("validateJudgeGate: accepts a fully controlled judge gate", validateJudgeGate(good).length === 0);
ok("validateJudgeGate: rejects missing order-swap controls", validateJudgeGate(missingSwap).some((e) => e.includes("order_swap")));
ok("validateJudgeGate: rejects missing self-preference control", validateJudgeGate(missingControls).some((e) => e.includes("self-preference")));
ok("validateReplay: accepts consistent swapped verdict replay", validateReplay(replayGood).length === 0);
ok("validateReplay: swapped disagreement fails without escalation", validateReplay(replayDisagreementNoEscalation).some((e) => e.includes("escalation")));
ok("validateReplay: swapped disagreement passes when escalation is recorded", validateReplay(replayDisagreementEscalated).length === 0);

const manifests = walkNamed(join(ROOT, "standards"), "judge-gate.json");
ok("scan: at least one real judge-gate manifest exists", manifests.length > 0, "expected a standards/*/judge-gate.json");
let firstBad = "";
const gatesNeedingReplay = [];
for (const f of manifests) {
  try {
    const gate = JSON.parse(readFileSync(f, "utf8"));
    const errors = validateJudgeGate(gate);
    if (errors.length && !firstBad) firstBad = `${f.slice(ROOT.length + 1)}: ${errors.join("; ")}`;
    if (gate.order_swap && gate.order_swap.enabled === true) gatesNeedingReplay.push(gate.id);
  } catch (err) {
    if (!firstBad) firstBad = `${f.slice(ROOT.length + 1)}: ${err.message}`;
  }
}
ok("scan: every real judge-gate manifest declares bias controls", firstBad === "", firstBad);

const replayFiles = walkNamed(join(ROOT, "standards"), "judge-replay.json");
ok("scan: at least one real judge-replay artifact exists", replayFiles.length > 0, "expected a standards/*/judge-replay.json");
const replayGateIds = new Set();
let firstBadReplay = "";
for (const f of replayFiles) {
  try {
    const replay = JSON.parse(readFileSync(f, "utf8"));
    const errors = validateReplay(replay);
    if (replay.gate_id) replayGateIds.add(replay.gate_id);
    if (errors.length && !firstBadReplay) firstBadReplay = `${f.slice(ROOT.length + 1)}: ${errors.join("; ")}`;
  } catch (err) {
    if (!firstBadReplay) firstBadReplay = `${f.slice(ROOT.length + 1)}: ${err.message}`;
  }
}
ok("scan: every real judge-replay artifact is valid", firstBadReplay === "", firstBadReplay);
const missingReplay = gatesNeedingReplay.filter((id) => !replayGateIds.has(id));
ok("scan: every order-swap judge gate has replay proof", missingReplay.length === 0, missingReplay.join(", "));

for (const f of ["validate.mjs", "README.md"]) ok(`file present: ${f}`, existsSync(join(__dirname, f)));

const failed = checks.filter((c) => !c.pass);
for (const c of checks) if (!c.pass) console.log(`  FAIL ${c.name}${c.detail ? `  [${c.detail}]` : ""}`);
console.log(`judge-bias: ${checks.length - failed.length}/${checks.length} selftest checks passed`);
process.exit(failed.length ? 1 : 0);
