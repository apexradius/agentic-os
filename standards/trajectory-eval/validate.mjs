#!/usr/bin/env node
// validate.mjs — the trajectory-eval standard selftest, run bare or by `validate.mjs --all`. Proves
// the MECHANISM deterministically, zero npm, no network, no live model:
//   1. loadTrajectory/validateTrajectory accept a good doc and reject a malformed one.
//   2. The pure scorers (levenshtein, toolPathScore, verificationDiscipline, questionStops) are exact.
//   3. compareToBaseline over the on-disk fixtures: mock-pass PASSES, mock-regress REGRESSES on the
//      three gating dimensions (tool-path, verification, question-economy).
//   4. scoreJudge is judge-required with no provider, agrees under a consistent mock, escalates when
//      the order-swap verdicts disagree (the judge-bias order-swap rule, exercised).
//   5. exportFromRows turns spans-shaped rows into a valid trajectory.
//   6. PRESENCE of every shipped file; zone-purity over the standard dir.
// The LIVE judge provider is instance-supplied and never exercised here — that is the skip()'d branch.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTrajectory, validateTrajectory, toolPath, operatorAsks, planApprovals } from "./lib/trajectory.mjs";
import { levenshtein, toolPathScore, verificationDiscipline } from "./lib/score-deterministic.mjs";
import { compareToBaseline } from "./lib/regression.mjs";
import { scoreJudge } from "./lib/score-judge.mjs";
import { exportFromRows, promptFingerprint, promptFingerprintFromFile } from "./lib/export.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const checks = [];
const ok = (name, cond, detail = "") => { checks.push({ name, pass: !!cond, detail }); return !!cond; };
const skip = (name, reason) => { checks.push({ name, pass: true, detail: `SKIPPED — ${reason}` }); };

const read = (rel) => readFileSync(join(__dirname, rel), "utf8");
const baseline = loadTrajectory(read("fixtures/mock-baseline.trajectory.json"));
const passCand = loadTrajectory(read("fixtures/mock-pass.trajectory.json"));
const regressCand = loadTrajectory(read("fixtures/mock-regress.trajectory.json"));

// ── 1. load / validate ───────────────────────────────────────────────────────────
ok("loadTrajectory: baseline fixture is valid", baseline.errors.length === 0, baseline.errors.join("; "));
ok("loadTrajectory: pass fixture is valid", passCand.errors.length === 0, passCand.errors.join("; "));
ok("loadTrajectory: regress fixture is valid", regressCand.errors.length === 0, regressCand.errors.join("; "));
ok("validateTrajectory: wrong schema id is rejected", validateTrajectory({ schema: "bogus/9", trace_id: "t", provenance: { model: "m", prompt_version: null, task_fingerprint: "f" }, spans: [] }).some((e) => e.includes("schema")));
ok("validateTrajectory: missing provenance.model is rejected", validateTrajectory({ schema: "trajectory/1", trace_id: "t", provenance: { prompt_version: null, task_fingerprint: "f" }, spans: [] }).some((e) => e.includes("provenance.model")));
ok("validateTrajectory: a span without span_id is rejected", validateTrajectory({ schema: "trajectory/1", trace_id: "t", provenance: { model: "m", prompt_version: null, task_fingerprint: "f" }, spans: [{ operation: "chat" }] }).some((e) => e.includes("span_id")));
ok("loadTrajectory: bad JSON returns an error, does not throw", loadTrajectory("{not json").errors.length > 0);

// ── 2. pure scorers ───────────────────────────────────────────────────────────────
ok("levenshtein: identical → 0", levenshtein(["a", "b", "c"], ["a", "b", "c"]) === 0);
ok("levenshtein: one substitution → 1", levenshtein(["a", "b", "c"], ["a", "b", "d"]) === 1);
ok("levenshtein: empty vs len-2 → 2", levenshtein([], ["a", "b"]) === 2);
ok("toolPathScore: identical → 1", toolPathScore(["Read", "Write"], ["Read", "Write"]) === 1);
ok("toolPathScore: two empty paths → 1", toolPathScore([], []) === 1);
ok("toolPathScore: one sub over three → 0.667", Math.abs(toolPathScore(["Read", "Write", "Write"], ["Read", "Write", "Bash"]) - 2 / 3) < 1e-9);
ok("toolPath: baseline path is [Read, Write, Bash]", JSON.stringify(toolPath(baseline.trajectory)) === JSON.stringify(["Read", "Write", "Bash"]));
const verB = verificationDiscipline(baseline.trajectory);
ok("verificationDiscipline: baseline every mutation verified → 1.0", verB.mutations === 1 && verB.verified === 1 && verB.score === 1);
const verR = verificationDiscipline(regressCand.trajectory);
ok("verificationDiscipline: regress two mutations, none verified → 0.0", verR.mutations === 2 && verR.verified === 0 && verR.score === 0);
ok("operatorAsks: baseline declares an ask vocab and has zero ask spans", (() => { const a = operatorAsks(baseline.trajectory, ["AskUser"]); return a.gateable === true && a.count === 0; })());
ok("operatorAsks: regress has two operator-ask spans", operatorAsks(regressCand.trajectory, ["AskUser"]).count === 2);

// ── 3. compareToBaseline: RED/GREEN over the fixtures ───────────────────────────────
const green = compareToBaseline(passCand.trajectory, baseline.trajectory);
ok("compare: mock-pass clears the floor", green.floor_pass === true);
ok("compare: mock-pass does not regress", green.regressed === false);
ok("compare: mock-pass overall verdict is pass", green.pass === true);

const red = compareToBaseline(regressCand.trajectory, baseline.trajectory);
ok("compare: mock-regress fails the floor", red.floor_pass === false);
ok("compare: mock-regress is flagged regressed", red.regressed === true);
ok("compare: mock-regress overall verdict is NOT pass", red.pass === false);
ok("compare: mock-regress tool-path misses its bar", red.dimensions.tool_path.meets_threshold === false);
ok("compare: mock-regress verification misses its bar", red.dimensions.verification_discipline.meets_threshold === false);
ok("compare: mock-regress question-economy over the max", red.dimensions.question_economy.meets_threshold === false);

// ── 3b. operator-ask semantics (F13): asks not turn boundaries, plan-approvals excluded, ungateable when undeclared ──
const askDiscriminator = { spans: [
  { span_id: "d1", operation: "chat", start_ts: "2026-01-01T00:00:01Z", finish_reason: "end_turn" },
  { span_id: "d2", operation: "chat", start_ts: "2026-01-01T00:00:02Z", finish_reason: "end_turn" },
  { span_id: "d3", operation: "chat", start_ts: "2026-01-01T00:00:03Z", finish_reason: "end_turn" },
  { span_id: "d4", operation: "chat", start_ts: "2026-01-01T00:00:04Z", finish_reason: "end_turn" },
  { span_id: "d5", operation: "execute_tool", name: "execute_tool AskUser", start_ts: "2026-01-01T00:00:05Z", tool_name: "AskUser" },
] };
const planSpans = { spans: [{ span_id: "pp1", operation: "execute_tool", name: "execute_tool ApprovePlan", tool_name: "ApprovePlan" }] };
ok("operatorAsks: counts ask spans, not end_turn boundaries; plan-approvals are a separate class",
  operatorAsks(askDiscriminator, ["AskUser"]).count === 1 &&
  operatorAsks(planSpans, ["AskUser"]).count === 0 &&
  planApprovals(planSpans, ["ApprovePlan"]) === 1);
ok("operatorAsks: no declared ask vocabulary → ungateable (never vacuously passed)",
  operatorAsks(askDiscriminator, null).gateable === false);
const noVocabBase = { ...baseline.trajectory, annotations: { phases: [], exemplifies: [], expected_finding_classes: [] } };
const noVocab = compareToBaseline(passCand.trajectory, noVocabBase);
ok("compare: baseline without operator_ask → question-economy is ask-vocabulary-required, not gating",
  noVocab.dimensions.question_economy.gating === false && noVocab.dimensions.question_economy.status === "ask-vocabulary-required");
const twoAskCand = { schema: "trajectory/1", trace_id: "twoask", provenance: { model: "m", prompt_version: null, task_fingerprint: "f" }, spans: [
  { span_id: "ta1", operation: "execute_tool", name: "execute_tool Read", start_ts: "2026-01-01T00:00:01Z", tool_name: "Read" },
  { span_id: "ta2", operation: "execute_tool", name: "execute_tool Write", start_ts: "2026-01-01T00:00:02Z", tool_name: "Write" },
  { span_id: "ta3", operation: "execute_tool", name: "execute_tool Bash", start_ts: "2026-01-01T00:00:03Z", tool_name: "Bash" },
  { span_id: "ta4", operation: "execute_tool", name: "execute_tool AskUser", start_ts: "2026-01-01T00:00:04Z", tool_name: "AskUser" },
  { span_id: "ta5", operation: "execute_tool", name: "execute_tool AskUser", start_ts: "2026-01-01T00:00:05Z", tool_name: "AskUser" },
] };
const isolated = compareToBaseline(twoAskCand, baseline.trajectory);
ok("compare: a 2-ask candidate fails question-economy (verification intact, plan_approvals surfaced)",
  isolated.dimensions.question_economy.meets_threshold === false &&
  isolated.dimensions.verification_discipline.meets_threshold === true &&
  typeof isolated.dimensions.question_economy.plan_approvals === "number" &&
  isolated.floor_pass === false);

// ── 3c. threshold-0 = fully ungated (F14): a score dimension whose baseline threshold is 0 is excluded from BOTH floor and regression ──
const thresh0Baseline = { schema: "trajectory/1", trace_id: "t0base", provenance: { model: "m", prompt_version: null, task_fingerprint: "f" },
  thresholds: { tool_path: 0, verification_discipline: 1.0, question_economy_max: 1, regression_tolerance: 0.05 },
  annotations: { tool_classes: { operator_ask: ["AskUser"], plan_approval: ["ApprovePlan"] } },
  spans: [
    { span_id: "z0", parent_span_id: null, operation: "invoke_agent", name: "invoke_agent executor", start_ts: "2026-01-01T00:00:00Z", agent_type: "executor" },
    { span_id: "z1", operation: "execute_tool", name: "execute_tool Read", start_ts: "2026-01-01T00:00:01Z", tool_name: "Read" },
    { span_id: "z2", operation: "execute_tool", name: "execute_tool Grep", start_ts: "2026-01-01T00:00:02Z", tool_name: "Grep" },
    { span_id: "z3", operation: "execute_tool", name: "execute_tool Write", start_ts: "2026-01-01T00:00:03Z", tool_name: "Write" },
    { span_id: "z4", operation: "execute_tool", name: "execute_tool Bash", start_ts: "2026-01-01T00:00:04Z", tool_name: "Bash" },
  ] };
const lowPathCand = { schema: "trajectory/1", trace_id: "lowpath", provenance: { model: "m2", prompt_version: null, task_fingerprint: "f" }, spans: [
  { span_id: "w0", parent_span_id: null, operation: "invoke_agent", name: "invoke_agent executor", start_ts: "2026-01-02T00:00:00Z", agent_type: "executor" },
  { span_id: "w1", operation: "execute_tool", name: "execute_tool Write", start_ts: "2026-01-02T00:00:01Z", tool_name: "Write" },
  { span_id: "w2", operation: "execute_tool", name: "execute_tool Bash", start_ts: "2026-01-02T00:00:02Z", tool_name: "Bash" },
] };
const t0 = compareToBaseline(lowPathCand, thresh0Baseline);
ok("gateHigher: tool_path threshold 0 → dimension gating:false, scores informational (no meets/regressed)",
  t0.dimensions.tool_path.gating === false && typeof t0.dimensions.tool_path.candidate === "number" && t0.dimensions.tool_path.meets_threshold === undefined);
ok("compare: a low-tool_path candidate PASSES against a threshold-0 baseline (F14 red→green)",
  t0.pass === true && t0.floor_pass === true && t0.regressed === false && t0.dimensions.tool_path.gating === false);
const vd0Baseline = { ...thresh0Baseline, trace_id: "vd0base", thresholds: { tool_path: 0.7, verification_discipline: 0, question_economy_max: 1, regression_tolerance: 0.05 } };
ok("gateHigher: verification_discipline threshold 0 also fully ungates (uniform, not tool_path-only)",
  compareToBaseline(lowPathCand, vd0Baseline).dimensions.verification_discipline.gating === false);
ok("compare: a NONZERO threshold still gates floor AND regression (preservation)",
  red.dimensions.tool_path.gating === true && red.pass === false);

// ── 3d. floor degeneracy: zero mutation spans → floor_degenerate flag (verdict-neutral) ──
const readOnlyCand = { schema: "trajectory/1", trace_id: "readonly", provenance: { model: "m2", prompt_version: null, task_fingerprint: "f" }, spans: [
  { span_id: "r0", parent_span_id: null, operation: "invoke_agent", name: "invoke_agent executor", start_ts: "2026-01-03T00:00:00Z", agent_type: "executor" },
  { span_id: "r1", operation: "execute_tool", name: "execute_tool Read", start_ts: "2026-01-03T00:00:01Z", tool_name: "Read" },
  { span_id: "r2", operation: "execute_tool", name: "execute_tool Grep", start_ts: "2026-01-03T00:00:02Z", tool_name: "Grep" },
] };
const degen = compareToBaseline(readOnlyCand, baseline.trajectory);
ok("compare: zero-mutation candidate → floor_degenerate true with reason (vacuous verification)",
  degen.floor_degenerate === true && typeof degen.floor_degenerate_reason === "string");
ok("compare: mutating candidate → floor_degenerate false, verdict fields unchanged",
  green.floor_degenerate === false && green.floor_degenerate_reason === undefined && green.pass === true);

// ── 4. judge layer: no provider / consistent / order-swap disagreement ──────────────
const noProvider = await scoreJudge({ candidate: passCand.trajectory, baseline: baseline.trajectory });
ok("scoreJudge: no provider → not gradeable (judge-required)", noProvider.gradeable === false && Object.values(noProvider.dimensions).every((d) => d.gradeable === false));
const agree = await scoreJudge({ candidate: passCand.trajectory, baseline: baseline.trajectory, provider: async () => "pass" });
ok("scoreJudge: consistent mock provider → gradeable, every verdict pass", agree.gradeable === true && Object.values(agree.dimensions).every((d) => d.verdict === "pass"));
const disagree = await scoreJudge({
  candidate: passCand.trajectory,
  baseline: baseline.trajectory,
  provider: async ({ presentation }) => (presentation === "candidate-first" ? "pass" : "fail"),
});
ok("scoreJudge: order-swap disagreement escalates, not silently taken", disagree.gradeable === false && disagree.escalations.length > 0 && Object.values(disagree.dimensions).every((d) => d.escalate === true));

// ── 5. exportFromRows: spans-shaped rows → a valid trajectory ───────────────────────
const rows = [
  { trace_id: "x", span_id: "e1", parent_span_id: null, operation: "invoke_agent", name: "invoke_agent executor", start_ts: "2026-01-01T00:00:00Z", agent_type: "executor", model: "mock-model-c", self_report: "completed", attributes_json: "{}" },
  { trace_id: "x", span_id: "e2", parent_span_id: "e1", operation: "execute_tool", name: "execute_tool Read", start_ts: "2026-01-01T00:00:01Z", tool_name: "Read", attributes_json: "{}" },
];
const exported = exportFromRows(rows, { trace_id: "x", task_fingerprint: "task:demo" });
const exportedErrors = validateTrajectory(exported);
ok("exportFromRows: produces a schema-valid trajectory", exportedErrors.length === 0, exportedErrors.join("; "));
ok("exportFromRows: infers model from the spans when not passed", exported.provenance.model === "mock-model-c");
ok("exportFromRows: keeps every row as a span", exported.spans.length === 2);

// ── 5b. prompt fingerprint (F10): deterministic, body-sensitive, null on a missing file ─────
ok("promptFingerprint: stable for identical content",
  promptFingerprint("---\nname: a\n---\nbody one") === promptFingerprint("---\nname: a\n---\nbody one"));
ok("promptFingerprint: changes when the prompt body changes",
  promptFingerprint("---\nname: a\n---\nbody one") !== promptFingerprint("---\nname: a\n---\nbody two"));
ok("promptFingerprint: algorithm-tagged short sha256 shape", /^sha256:[0-9a-f]{16}$/.test(promptFingerprint("x")));
ok("promptFingerprintFromFile: missing path → null (never fabricated)",
  promptFingerprintFromFile(join(__dirname, "no-such-prompt.md")) === null);
ok("promptFingerprintFromFile: falsy path → null", promptFingerprintFromFile("") === null);
ok("promptFingerprintFromFile: hashes the file's own content",
  promptFingerprintFromFile(join(__dirname, "README.md")) === promptFingerprint(readFileSync(join(__dirname, "README.md"), "utf8")));
const withPv = exportFromRows(rows, { trace_id: "x", task_fingerprint: "task:demo", prompt_version: "sha256:0123456789abcdef" });
ok("exportFromRows: threads a supplied prompt_version into provenance", withPv.provenance.prompt_version === "sha256:0123456789abcdef");

// The live judge provider is instance-supplied — the warned/skipped branch, never run by --all.
skip("live judge provider path (instance-supplied)", "no --provider in CI — MOCK order-swap path covers the mechanism");

// ── 6. PRESENCE ─────────────────────────────────────────────────────────────────
const EXPECTED = [
  "run.mjs", "README.md", "trajectory.schema.json",
  "lib/trajectory.mjs", "lib/score-deterministic.mjs", "lib/regression.mjs", "lib/score-judge.mjs", "lib/export.mjs",
  "fixtures/mock-baseline.trajectory.json", "fixtures/mock-pass.trajectory.json", "fixtures/mock-regress.trajectory.json",
  "judge-gate.json", "judge-replay.json", "judge-validity-gold.json",
];
for (const rel of EXPECTED) ok(`PRESENCE: ${rel} exists`, existsSync(join(__dirname, rel)));

// ── 7. zone-purity over the standard dir (forbidden literals split-joined; exclude this file) ──
const FORBIDDEN = [
  ["apex", "radius"].join(""), ["trade", "ops"].join(""), ["ko", "vara"].join(""),
  ["/Users/", "apex"].join(""), ["/home/", "adam"].join(""), [148, 113, 202, 79].join("."),
];
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
  const p = join(dir, d.name);
  return d.isDirectory() ? walk(p) : [p];
});
let zoneHit = "";
for (const f of walk(__dirname).filter((f) => !f.endsWith("validate.mjs"))) {
  const txt = readFileSync(f, "utf8");
  for (const tok of FORBIDDEN) if (txt.includes(tok)) zoneHit = `${f}: ${tok}`;
}
ok("zone-purity: no Apex coupling in the standard dir", zoneHit === "", zoneHit);

const failed = checks.filter((c) => !c.pass);
for (const c of checks) if (!c.pass) console.log(`  FAIL ${c.name}${c.detail ? `  [${c.detail}]` : ""}`);
console.log(`trajectory-eval: ${checks.length - failed.length}/${checks.length} selftest checks passed`);
process.exit(failed.length ? 1 : 0);
