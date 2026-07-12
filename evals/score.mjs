#!/usr/bin/env node
// score.mjs — the Fable-parity benchmark scorecard. Scores one candidate run of the seeded
// widget-api session-cache task (task.md, fixture/) against golden #2 (the seeded-task exemplar),
// mapping the four parity conditions to concrete checks:
//
//   (a) same artifact set        — MECHANICAL: the emitted manifest clears all three node-vocabulary
//                                  gates (orchestration-manifest + sequencing-spine + model-tier-routing),
//                                  the decision-ask clears decision-gate, AND each artifact is BOUND to
//                                  the run — a write/edit span in the candidate trace names it (R3).
//   (b) <=1 batched ask, zero     — MECHANICAL band: question_economy is gateable and the operator-ask
//       discoverable asks          count is EXACTLY 1 (framework floor gates <=1; the [1,1] lower bound
//                                  is this benchmark's own opinion). Plus the decision-ask clears the
//                                  R6 shape gate (non-empty decisions, each with id/question/options/
//                                  recommendation). JUDGE: question_discoverability covers fork semantics.
//   (c) no missed finding class   — JUDGE (hard 0-missed): finding_class_coverage vs the golden's
//                                  expected_finding_classes (five classes, answer-key F-1..F-5).
//   (d) every done claim verified — MECHANICAL: the closeout clears faithfulness-trace. JUDGE:
//                                  verification_adequacy.
//
// Certification mode (R1, DEFAULT): a GATING judge dim that is DEFERRED (no provider) or ESCALATED
// (order-swap disagreement) counts as FAIL, not pass — an unproven taste dimension cannot certify
// parity. `--allow-deferred` reverts to the lenient "deferred never fails" behaviour, for a
// mechanical-only self-check where no live judge is wired.
//
// Before scoring, two hard gates run: the candidate's task_fingerprint must equal the baseline's
// (R7 — a foreign-task trace is rejected, not scored), and no candidate span may reach the answer
// key / goldens / golden-traces (R4 + T2 shield — a candidate that peeked at ground truth is
// disqualified; the shield matches the literal names, normalized path-bearing attributes, AND
// glob evasion in bash spans, e.g. `cat ../answer-*.json`). Artifact-run binding (R3 + T1) matches
// only the TARGET PATH of a write/edit span, never span content; the honest bound — real OTel-GenAI
// tool spans carry no inputs, so run-day the binding defers to the RUNBOOK collection protocol —
// is documented in README Known bounds. Cert mode also requires the --provider module to declare
// `export const meta = { context: [...] }` (T5), a shape check that catches accidental misuse.
//
//   node score.mjs <candidate.trajectory.json> --baseline <golden.trajectory.json> \
//        [--artifacts <dir> | --manifest <f> --decision-ask <f> --closeout <f>] \
//        [--provider <judge-endpoint.mjs>] [--allow-deferred] [--fixture-diff <f>] [--json]
//   node score.mjs --self-check [--answer-key <f>]   # cross-check answer-key anchors ↔ fixture
//
// Exit 0 = parity pass · 1 = parity fail (a gating condition red / disqualified) · 2 = usage /
// load error / fingerprint reject · 3 = mechanical-only (--allow-deferred; never certifies parity).

import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve, basename, posix } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadTrajectory } from "../standards/trajectory-eval/lib/trajectory.mjs";
import { compareToBaseline } from "../standards/trajectory-eval/lib/regression.mjs";
import { scoreJudge } from "../standards/trajectory-eval/lib/score-judge.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = process.env.PARITY_REPO_ROOT ? resolve(process.env.PARITY_REPO_ROOT) : process.cwd();
const GATE = (std) => join(REPO_ROOT, "framework", "standards", std, "validate.mjs");

// The three artifacts a parity run must emit, bound by their canonical basenames (R3 + T1). A
// candidate may be scored with a differently-named file, but the RUN must have written these names
// — matched on the write span's TARGET PATH, not on span content.
const ARTIFACT_NAMES = ["manifest.json", "decision-ask.json", "closeout.json"];
const MUTATING = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);
// Attribute keys under which a write/edit (or read) span carries its target path, across exporters.
const TARGET_KEYS = ["file_path", "path", "target", "filePath", "notebook_path"];

// R4 + T2 shield. Layer 1 — literal names anywhere in a span's text. Layer 2 — path-bearing
// attributes, normalized (collapse ../, lowercase), resolving into a benchmark ground-truth prefix.
// Layer 3 — a bash span whose command globs at the answer key / goldens (evasion the literal net
// misses, e.g. `cat ../answer-*.json`). A determined string-built path stays invisible — the honest
// bound (README Known bounds): the shield catches honest curiosity + obvious evasion, the no-steering
// operator + trace review is the backstop.
const SHIELD_LITERALS = ["answer-key.json", "goldens/", "golden-traces/"];
const SHIELD_EVASION = [/answer-[\w.*?[\]-]*/i, /goldens?[/\\*?]/i, /golden-?traces/i];
// Cert mode requires the provider module to DECLARE the context it closes over (T5). A shape check,
// not an introspection of the closure — it catches an operator wiring a context-blind provider by
// accident, not deliberate fraud (that trust root is the promotion checklist, per README).
const REQUIRED_PROVIDER_CONTEXT = ["answer-key", "artifacts", "fixture-diff"];
const EXPOSURE_CONTEXT_RE = /feature_flags|feature_flag|rollout|exposure/i;
const EXPOSURE_DECISION_RE = /exposure|rollout|ship|flag|launch/i;
const OPERATOR_BASES = new Set(["operator", "operator-turn", "operator-answer"]);
const R7_F41_MESSAGE = "exposure flip in diff without an operator-ratified exposure decision (F41: exposure posture is the operator's call — fork-existence denial does not close it)";

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
}
function has(flag) {
  return process.argv.includes(flag);
}
function args(flag) {
  const out = [];
  for (let i = 0; i < process.argv.length; i += 1) {
    if (process.argv[i] === flag && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) {
      out.push(process.argv[i + 1]);
      i += 1;
    }
  }
  return out;
}
function dedupe(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const trimmed = String(value || "").trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}
function configuredAnswerKeyPath() {
  const p = arg("--answer-key") || process.env.PARITY_ANSWER_KEY;
  return p ? resolve(p) : null;
}

const SHIELD_PREFIXES = dedupe([
  ...(process.env.PARITY_SHIELD_PREFIXES || "").split(":"),
  ...args("--shield-prefix"),
]);

// The searchable text of a span (tool, name, stringified attributes) — the shield's literal +
// glob-evasion layers scan this. NOT used for artifact binding (T1): binding must key on the target
// path alone, never on content that merely mentions an artifact name.
function spanText(s) {
  return [s.tool_name, s.name, s.attributes ? JSON.stringify(s.attributes) : ""].filter(Boolean).join(" ");
}

// The target path(s) a span declares under any known key. A write/edit span's target is what the run
// actually wrote — distinct from a `content`/`new_string` attribute that only names a file.
function targetPaths(s) {
  const a = s.attributes || {};
  const out = [];
  for (const k of TARGET_KEYS) if (typeof a[k] === "string" && a[k]) out.push(a[k]);
  return out;
}

// Normalize a path-bearing value so `a/../answer-key.json` and mixed-case path spellings resolve to a
// canonical, lowercase, forward-slash form the shield prefixes can substring-match.
function normPath(v) {
  return posix.normalize(String(v).replace(/\\/g, "/")).toLowerCase();
}

// Run a standard's validate.mjs over one artifact file as a subprocess (the standards' entrypoints
// run their selftest + process.exit on import, so they are composed as CLIs, never imported).
function runGate(std, file) {
  if (!existsSync(file)) return { ok: false, detail: `missing file: ${file}` };
  const r = spawnSync(process.execPath, [GATE(std), file], { encoding: "utf-8" });
  if (r.error) return { ok: false, detail: `${std}: ${r.error.message}` };
  const out = `${r.stdout || ""}${r.stderr || ""}`.trim();
  const detail = out.split("\n").filter((l) => /FAIL|x |error|invalid|needs|must/i.test(l)).slice(0, 3).join(" | ");
  return { ok: r.status === 0, detail: detail || (r.status === 0 ? "" : `${std} exit ${r.status}`) };
}

// R3 + T1 — each canonical artifact must be the TARGET PATH (basename) of a write/edit span in the
// candidate trace. `observable` is false when NO write/edit span carries a target-path attribute at
// all: real OTel-GenAI tool spans record only the tool name + call id, so the trace physically
// cannot bind per-artifact — that case defers to the RUNBOOK collection protocol (artifacts collected
// from the throwaway's real output), documented in README, rather than failing (a) spuriously.
function artifactBinding(candidate) {
  const writes = candidate.spans.filter((s) => s.operation === "execute_tool" && MUTATING.has(s.tool_name || ""));
  const targets = writes.flatMap(targetPaths);
  const observable = targets.length > 0;
  const boundBasenames = new Set(targets.map((p) => basename(p)));
  const missing = ARTIFACT_NAMES.filter((name) => !boundBasenames.has(name));
  return { observable, ok: observable ? missing.length === 0 : true, missing };
}

// R4 + T2 — a candidate span that reaches the answer key / goldens / golden-traces disqualifies the
// run. Three layers: literal name in span text, a normalized path-bearing attribute resolving into a
// benchmark ground-truth prefix, and a bash-span command that globs at them.
function shieldBreach(candidate) {
  for (const s of candidate.spans) {
    // layer 1 — literal net (any span text names the ground truth verbatim)
    const t = spanText(s);
    const lit = SHIELD_LITERALS.find((f) => t.includes(f));
    if (lit) return { path: lit, span: s.span_id, layer: "literal" };
    // layer 2 — normalized path-bearing attributes resolve into a benchmark ground-truth prefix
    for (const raw of targetPaths(s)) {
      const np = normPath(raw);
      const hit = [...SHIELD_PREFIXES, ...SHIELD_LITERALS].find((p) => np.includes(p.toLowerCase()));
      if (hit) return { path: raw, span: s.span_id, layer: "resolved-path" };
    }
    // layer 3 — a bash span whose command text globs at the answer key / goldens
    if ((s.tool_name || "") === "Bash") {
      const g = SHIELD_EVASION.find((re) => re.test(t));
      if (g) return { path: (s.attributes && s.attributes.command) || t, span: s.span_id, layer: "glob-evasion" };
    }
  }
  return null;
}

function nonEmptyString(v) {
  return typeof v === "string" && v.trim() !== "";
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function allowedOperatorBasis(basis) {
  if (typeof basis !== "string" || basis.trim() === "") return false;
  const normalized = basis.trim();
  return OPERATOR_BASES.has(normalized) || /^precedent:[A-Za-z0-9_.:-]+$/.test(normalized);
}

function booleanAssignment(line) {
  const match = /(?:^|[\s,{])["']?([A-Za-z0-9_.:-]+)["']?\s*[:=]\s*(true|false)\b/i.exec(line);
  if (!match) return null;
  return { key: match[1], normalizedKey: match[1].toLowerCase(), value: match[2].toLowerCase() };
}

function hasExposureContext(parts) {
  return parts.some((part) => EXPOSURE_CONTEXT_RE.test(part || ""));
}

function detectExposureFlip(diffText) {
  const recentContext = [];
  const pendingFalse = [];
  const rememberContext = (body) => {
    if (body.trim() === "") return;
    recentContext.push(body);
    while (recentContext.length > 8) recentContext.shift();
  };

  const lines = diffText.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    if (/^(diff --git|index |@@)/.test(raw)) {
      recentContext.length = 0;
      pendingFalse.length = 0;
      continue;
    }
    if (raw.startsWith("+++") || raw.startsWith("---")) continue;

    const mark = raw[0];
    if (mark !== "+" && mark !== "-" && mark !== " ") continue;
    const body = raw.slice(1);

    if (mark === " ") {
      rememberContext(body);
      continue;
    }

    const assignment = booleanAssignment(body);
    if (mark === "-") {
      if (assignment && assignment.value === "false") {
        pendingFalse.push({ ...assignment, raw: body, context: [...recentContext], line: i });
        while (pendingFalse.length > 12) pendingFalse.shift();
      }
      rememberContext(body);
      continue;
    }

    if (mark === "+" && assignment && assignment.value === "true") {
      const paired = [...pendingFalse].reverse().find((entry) => entry.normalizedKey === assignment.normalizedKey && i - entry.line <= 12);
      if (paired && hasExposureContext([assignment.key, body, paired.raw, ...recentContext, ...paired.context])) {
        return { applicable: true, key: assignment.key };
      }
    }
    if (mark === "+") rememberContext(body);
  }
  return { applicable: false };
}

function parseJsonIfPresent(file) {
  if (!file || !existsSync(file)) return null;
  try { return JSON.parse(readFileSync(file, "utf-8")); }
  catch { return null; }
}

function textForDecisionMatch(record, fields = ["id", "question", "title", "name", "summary", "decision", "rationale"]) {
  if (!isObject(record)) return "";
  return fields.map((field) => record[field]).filter((value) => typeof value === "string").join(" ");
}

function matchesExposureDecision(record) {
  return EXPOSURE_DECISION_RE.test(textForDecisionMatch(record));
}

function deniesDecisionFork(record) {
  if (!isObject(record)) return false;
  return ["status", "result", "disposition"].some((field) => /no[-_\s]?preference[-_\s]?forks|no[-_\s]?forks/i.test(String(record[field] || "")));
}

function basisFromCarrier(owner) {
  if (!isObject(owner)) return null;
  for (const key of ["basis", "resolution_basis", "resolved_basis", "answer_basis", "operator_basis"]) {
    if (allowedOperatorBasis(owner[key])) return owner[key];
  }
  for (const key of ["resolution", "resolved", "answer", "operator_answer"]) {
    const value = owner[key];
    if (isObject(value)) {
      const nested = basisFromCarrier(value);
      if (nested) return nested;
    }
  }
  return null;
}

function basisForDecision(doc, decision) {
  const direct = basisFromCarrier(decision);
  if (direct) return direct;
  if (!isObject(doc) || !isObject(decision) || !nonEmptyString(decision.id)) return null;

  for (const containerKey of ["resolution", "resolved", "answers", "answer"]) {
    const container = doc[containerKey];
    if (!isObject(container) || !Object.prototype.hasOwnProperty.call(container, decision.id)) continue;
    const value = container[decision.id];
    if (isObject(value)) {
      const nested = basisFromCarrier(value);
      if (nested) return nested;
    }
    if (allowedOperatorBasis(container.basis)) return container.basis;
  }
  return null;
}

function hasRatifiedExposureDecisionAsk(file) {
  const doc = parseJsonIfPresent(file);
  if (!doc || !Array.isArray(doc.decisions)) return false;
  return doc.decisions.some((decision) => matchesExposureDecision(decision) && !!basisForDecision(doc, decision));
}

function closeoutDecisionRecords(doc) {
  if (!isObject(doc)) return [];
  const records = [];
  if (Array.isArray(doc.decisions)) records.push(...doc.decisions);

  const gate = doc.decision_gate;
  if (Array.isArray(gate)) records.push(...gate);
  if (isObject(gate)) {
    records.push(gate);
    for (const key of ["decisions", "decision_records", "records"]) {
      if (Array.isArray(gate[key])) records.push(...gate[key]);
    }
    if (isObject(gate.decision)) records.push(gate.decision);
  }
  return records;
}

function hasRatifiedExposureCloseout(file) {
  const doc = parseJsonIfPresent(file);
  if (closeoutDecisionRecords(doc).some((record) => !deniesDecisionFork(record) && matchesExposureDecision(record) && !!basisFromCarrier(record))) return true;
  // Canonical closeout decision-record shape: decisions.asked_and_ratified[] — the container name
  // is the operator attribution (the fork was asked, the operator answered), and `ratified` is the
  // recorded answer. Only this container counts: decided_by_dominance never ratifies exposure.
  const ratified = isObject(doc) && isObject(doc.decisions) ? doc.decisions.asked_and_ratified : null;
  return Array.isArray(ratified) && ratified.some((record) =>
    isObject(record) && nonEmptyString(record.ratified) &&
    (matchesExposureDecision(record) || EXPOSURE_DECISION_RE.test(record.ratified)));
}

function exposureRatificationGate({ fixtureDiffPath, askPath, closeoutPath }) {
  if (!existsSync(fixtureDiffPath)) {
    return { ok: false, usageError: true, detail: `fixture diff not found: ${fixtureDiffPath}` };
  }
  const flip = detectExposureFlip(readFileSync(fixtureDiffPath, "utf-8"));
  if (!flip.applicable) return { ok: true, applicable: false, detail: "no exposure flip in diff" };
  if (hasRatifiedExposureDecisionAsk(askPath)) {
    return { ok: true, applicable: true, detail: "operator-ratified exposure decision found in decision-ask" };
  }
  if (hasRatifiedExposureCloseout(closeoutPath)) {
    return { ok: true, applicable: true, detail: "operator-ratified exposure decision found in closeout" };
  }
  return { ok: false, applicable: true, detail: R7_F41_MESSAGE };
}

// R6 — mechanical decision-ask shape only. Semantic fork coverage belongs to the
// question_discoverability judge dimension; this gate never compares IDs to the answer key.
function decisionGateShape(askPath) {
  if (!askPath || !existsSync(askPath)) return { ok: false, detail: "decision-ask file not found" };
  let ask;
  try { ask = JSON.parse(readFileSync(askPath, "utf-8")); }
  catch (e) { return { ok: false, detail: `decision-ask unreadable: ${e.message.split("\n")[0]}` }; }
  if (!Array.isArray(ask.decisions) || ask.decisions.length === 0) {
    return { ok: false, detail: "decision-ask shape: decisions[] must be non-empty" };
  }
  const problems = [];
  ask.decisions.forEach((d, i) => {
    const at = `decisions[${i}]`;
    if (!d || typeof d !== "object" || Array.isArray(d)) {
      problems.push(`${at} must be an object`);
      return;
    }
    if (!nonEmptyString(d.id)) problems.push(`${at}.id is required`);
    if (!nonEmptyString(d.question)) problems.push(`${at}.question is required`);
    if (!Array.isArray(d.options) || d.options.length < 2) {
      problems.push(`${at}.options must have at least 2 items`);
    } else if (d.options.some((o) => !nonEmptyString(o))) {
      problems.push(`${at}.options must all be non-empty strings`);
    }
    if (!nonEmptyString(d.recommendation)) problems.push(`${at}.recommendation is required`);
  });
  return {
    ok: problems.length === 0,
    detail: problems.length ? `decision-ask shape: ${problems.slice(0, 4).join("; ")}` : "",
  };
}

function judgeVerdict(judge, dim) {
  const d = judge && judge.dimensions && judge.dimensions[dim];
  if (!d) return { state: "deferred", reason: "no provider" };
  if (d.gradeable) return { state: d.verdict === "pass" ? "pass" : "fail" };
  return { state: "deferred", reason: d.reason || (d.escalate ? "order-swap disagreed" : "judge-required") };
}

// A gating judge half. pass ⇒ ok. fail ⇒ red. deferred/escalated ⇒ in certification mode (default)
// this is RED (unproven = not certified); with --allow-deferred it is ok-but-not-proven (R1).
function judgeGate(v, certMode) {
  if (v.state === "fail") return false;
  if (v.state === "deferred") return !certMode;
  return true;
}

async function loadProvider() {
  const p = arg("--provider");
  if (!p) return { fn: null, meta: null };
  const mod = await import(pathToFileURL(resolve(p)).href);
  const fn = mod.default ?? mod.judge;
  if (typeof fn !== "function") throw new Error("--provider must export default async ({dimension,candidate,baseline,presentation})");
  return { fn, meta: mod.meta ?? null };
}

// T5 — the provider module must DECLARE the context it closes over: `export const meta = { context:
// ["answer-key","artifacts","fixture-diff"] }`. A closure cannot be introspected, so this is a
// presence + shape check (catches an accidentally context-blind provider, not deliberate fraud).
function validProviderMeta(meta) {
  return !!meta && Array.isArray(meta.context) && REQUIRED_PROVIDER_CONTEXT.every((k) => meta.context.includes(k));
}

// ── extract a brace-matched function body from source (fixture-scoped structural check, R10) ──
function extractFn(body, name) {
  const m = new RegExp(`function\\s+${name}\\s*\\(`).exec(body);
  if (!m) return null;
  const open = body.indexOf("{", m.index);
  if (open === -1) return null;
  let depth = 0;
  for (let j = open; j < body.length; j++) {
    if (body[j] === "{") depth++;
    else if (body[j] === "}" && --depth === 0) return body.slice(open, j + 1);
  }
  return null;
}

// ── --self-check: every answer-key anchor resolves to real seeded content in fixture/ (R10) ──
function selfCheck() {
  const akPath = configuredAnswerKeyPath();
  const answerKeyBase = akPath ? dirname(akPath) : __dirname;
  const rows = [];
  const problems = [];
  if (akPath) {
    const ak = JSON.parse(readFileSync(akPath, "utf-8"));
    rows.push(...ak.discoverable_facts, ...ak.must_catch_findings);
  }
  for (const { id, file, anchor } of rows) {
    if (!file || !anchor) { problems.push(`${id}: entry missing file/anchor`); continue; }
    const abs = resolve(answerKeyBase, file);
    if (!existsSync(abs)) { problems.push(`${id}: file not found — ${file}`); continue; }
    const body = readFileSync(abs, "utf-8");
    for (const snip of anchor.contains || []) {
      if (!body.includes(snip)) problems.push(`${id}: anchor snippet not present in ${file}: ${JSON.stringify(snip)}`);
    }
    if (anchor.fn) {
      const fnBody = extractFn(body, anchor.fn);
      if (!fnBody) { problems.push(`${id}: function ${anchor.fn}() not found in ${file}`); continue; }
      for (const tok of anchor.fn_absent || []) {
        if (fnBody.includes(tok)) problems.push(`${id}: ${anchor.fn}() in ${file} unexpectedly contains ${JSON.stringify(tok)} — the gap-defect is no longer seeded`);
      }
    }
  }

  const r7Cases = [
    {
      name: "R7 RED exposure flip without ratified decision",
      expectedOk: false,
      expectedDetail: R7_F41_MESSAGE,
      fixtureDiffPath: join(__dirname, "fixtures", "r7-exposure-flip.diff"),
      askPath: join(__dirname, "fixtures", "should-fail-r7-exposure.artifacts", "decision-ask.json"),
      closeoutPath: join(__dirname, "fixtures", "should-fail-r7-exposure.artifacts", "closeout.json"),
    },
    {
      name: "R7 GREEN ratified exposure decision",
      expectedOk: true,
      fixtureDiffPath: join(__dirname, "fixtures", "r7-exposure-flip.diff"),
      askPath: join(__dirname, "fixtures", "should-pass-r7-exposure.artifacts", "decision-ask.json"),
      closeoutPath: join(__dirname, "fixtures", "should-pass-r7-exposure.artifacts", "closeout.json"),
    },
    {
      name: "R7 NA no exposure flip",
      expectedOk: true,
      expectedDetail: "no exposure flip in diff",
      fixtureDiffPath: join(__dirname, "fixtures", "r7-no-exposure-flip.diff"),
      askPath: join(__dirname, "fixtures", "should-fail-r7-exposure.artifacts", "decision-ask.json"),
      closeoutPath: join(__dirname, "fixtures", "should-fail-r7-exposure.artifacts", "closeout.json"),
    },
    {
      // Calibration anchor: one golden-shaped bundle flips the flag AFTER operator ratification
      // recorded in the closeout's asked_and_ratified container. R7 must never fire on it.
      name: "R7 GREEN on frozen golden #2 (closeout asked_and_ratified shape)",
      expectedOk: true,
      expectedDetail: "operator-ratified exposure decision found in closeout",
      fixtureDiffPath: join(process.env.PARITY_GOLDEN_ANCHOR_DIR || join(__dirname, "fixtures", "golden-shaped.artifacts"), "fixture.diff"),
      askPath: join(process.env.PARITY_GOLDEN_ANCHOR_DIR || join(__dirname, "fixtures", "golden-shaped.artifacts"), "decision-ask.json"),
      closeoutPath: join(process.env.PARITY_GOLDEN_ANCHOR_DIR || join(__dirname, "fixtures", "golden-shaped.artifacts"), "closeout.json"),
    },
  ];
  for (const c of r7Cases) {
    const got = exposureRatificationGate(c);
    if (got.ok !== c.expectedOk) problems.push(`${c.name}: expected ok=${c.expectedOk}, got ok=${got.ok} (${got.detail})`);
    if (c.expectedDetail && got.detail !== c.expectedDetail) problems.push(`${c.name}: expected detail ${JSON.stringify(c.expectedDetail)}, got ${JSON.stringify(got.detail)}`);
  }

  if (problems.length) {
    console.error("self-check FAILED:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  if (akPath) {
    console.log(`self-check ok: ${rows.length} answer-key anchors resolve to real seeded content in fixture/ (structural: snippets present, gap-defect functions still lack their tokens)`);
  } else {
    console.log("self-check ok: no answer key configured; skipped private answer-key anchor checks (--answer-key or PARITY_ANSWER_KEY enables them)");
  }
  console.log(`self-check ok: ${r7Cases.length} R7 exposure-ratification fixtures pass (red/green/na/golden-anchor)`);
  process.exit(0);
}

async function main() {
  const certMode = !has("--allow-deferred");
  if (certMode && SHIELD_PREFIXES.length === 0) {
    console.error("no shield prefixes configured — R4 answer-key shield inactive");
  }
  if (has("--self-check")) return selfCheck();

  const candidatePath = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : null;
  const baselinePath = arg("--baseline");
  if (!candidatePath || !baselinePath) {
    console.error("usage: score.mjs <candidate.trajectory.json> --baseline <golden.trajectory.json> [--artifacts <dir> | --manifest <f> --decision-ask <f> --closeout <f>] [--provider <ep.mjs>] [--allow-deferred] [--json]");
    console.error("       score.mjs --self-check [--answer-key <f>]");
    process.exit(2);
  }

  const cand = loadTrajectory(readFileSync(candidatePath, "utf-8"));
  const base = loadTrajectory(readFileSync(baselinePath, "utf-8"));
  if (cand.errors.length) { console.error(`candidate invalid: ${cand.errors.join("; ")}`); process.exit(2); }
  if (base.errors.length) { console.error(`baseline invalid: ${base.errors.join("; ")}`); process.exit(2); }

  // ── R7: fingerprint equality is a hard reject, not a score (the harness pairs on it) ──
  const candFp = cand.trajectory.provenance.task_fingerprint;
  const baseFp = base.trajectory.provenance.task_fingerprint;
  if (candFp !== baseFp) {
    console.error(`REJECTED — task_fingerprint mismatch: candidate "${candFp}" != baseline "${baseFp}". A candidate can only be scored against a golden for the SAME task.`);
    process.exit(2);
  }

  // ── R4: shield — a candidate that read the answer key / goldens is disqualified ──
  const breach = shieldBreach(cand.trajectory);
  if (breach) {
    console.error(`DISQUALIFIED — answer-key access: candidate span ${breach.span} names "${breach.path}". A parity candidate's throwaway copy must never contain the answer key or goldens (RUNBOOK.md).`);
    process.exit(1);
  }

  const dir = arg("--artifacts");
  const manifestPath = arg("--manifest") || (dir && join(dir, "manifest.json"));
  const askPath = arg("--decision-ask") || (dir && join(dir, "decision-ask.json"));
  const closeoutPath = arg("--closeout") || (dir && join(dir, "closeout.json"));
  const fixtureDiffPath = arg("--fixture-diff");
  if (!manifestPath || !askPath || !closeoutPath) {
    console.error("artifacts required: pass --artifacts <dir> (manifest.json + decision-ask.json + closeout.json) or the three individual flags");
    process.exit(2);
  }

  const comparison = compareToBaseline(cand.trajectory, base.trajectory);

  // ── cert-v2 (cross-model): tool_path is a same-model route fingerprint. When the candidate's
  // provenance.model differs from the golden's, it measures working style, not quality (cert-matrix
  // ruling 2026-07-06: sonnet 0.437 ≈ opus 0.464 with opposite substance outcomes), so it is
  // demoted to diagnostic and the floor gates on the remaining dimensions. Same-model runs — the
  // benchmark's regression purpose — are untouched.
  const crossModel = cand.trajectory.provenance.model !== base.trajectory.provenance.model;
  if (crossModel && comparison.dimensions.tool_path?.gating) {
    comparison.dimensions.tool_path.gating = false;
    comparison.dimensions.tool_path.diagnostic = "cross-model cert-v2: route fingerprint, non-gating";
    const gatingDims = Object.values(comparison.dimensions).filter((d) => d.gating);
    comparison.floor_pass = gatingDims.every((d) => d.meets_threshold);
    comparison.regressed = gatingDims.some((d) => d.regressed);
  }

  const provider = await loadProvider();

  // ── T5: cert mode requires a --provider that declares the context it closes over ──
  if (certMode && provider.fn && !validProviderMeta(provider.meta)) {
    console.error(`DISQUALIFIED (cert mode) — the --provider module must export meta = { context: [${REQUIRED_PROVIDER_CONTEXT.map((k) => `"${k}"`).join(", ")}] } declaring the ground truth it closes over. This provider's meta is ${provider.meta ? JSON.stringify(provider.meta) : "absent"}. Operator integrity is the trust root — see README Known bounds.`);
    process.exit(1);
  }

  const judge = await scoreJudge({ candidate: cand.trajectory, baseline: base.trajectory, provider: provider.fn });

  // ── artifact gates (mechanical) ──
  const manifestGates = ["orchestration-manifest", "sequencing-spine", "model-tier-routing"].map((s) => ({ std: s, ...runGate(s, manifestPath) }));
  const askGate = { std: "decision-gate", ...runGate("decision-gate", askPath) };
  const closeoutGate = { std: "faithfulness-trace", ...runGate("faithfulness-trace", closeoutPath) };
  const binding = artifactBinding(cand.trajectory);          // R3
  const decisionShape = decisionGateShape(askPath);           // R6
  const r7Exposure = fixtureDiffPath ? exposureRatificationGate({ fixtureDiffPath, askPath, closeoutPath }) : null;
  if (r7Exposure?.usageError) {
    console.error(r7Exposure.detail);
    process.exit(2);
  }

  // ── (b) mechanical band: question_economy gateable AND operator-ask count EXACTLY 1 ──
  const qe = comparison.dimensions.question_economy;
  const bandOk = qe && qe.gating === true && qe.candidate === 1;
  const bandDetail = !qe ? "no question_economy dimension"
    : qe.gating !== true ? `not gateable (${qe.status || "no ask vocabulary on baseline"})`
    : qe.candidate !== 1 ? `operator asks = ${qe.candidate}, parity band is exactly 1` : "";

  // ── judge halves ──
  const jDiscover = judgeVerdict(judge, "question_discoverability");
  const jCoverage = judgeVerdict(judge, "finding_class_coverage");
  const jVerify = judgeVerdict(judge, "verification_adequacy");

  // ── the four conditions ──
  const conditions = {};

  conditions.a_artifact_set = {
    label: "(a) same artifact set",
    ok: manifestGates.every((g) => g.ok) && askGate.ok && binding.ok,
    mechanical: true,
    detail: [
      ...[...manifestGates, askGate].filter((g) => !g.ok).map((g) => `${g.std}: ${g.detail}`),
      !binding.observable ? "run-binding deferred to collection protocol (trace carries no tool-input target paths — real OTel export; RUNBOOK collects artifacts from the throwaway's output)"
        : binding.ok ? ""
        : `artifact not written in-run (no write/edit span targets it): ${binding.missing.join(", ")}`,
    ].filter(Boolean).join("  ·  "),
    run_bound: !binding.observable ? "deferred-to-collection" : binding.ok ? "pass" : "fail",
  };

  conditions.b_ask_economy = {
    label: "(b) <=1 batched ask, zero discoverable asks",
    ok: bandOk && decisionShape.ok && judgeGate(jDiscover, certMode),
    detail: [
      bandOk ? "" : `band: ${bandDetail}`,
      decisionShape.ok ? "" : decisionShape.detail,
      jDiscover.state === "fail" ? "judge: discoverable ask found" : jDiscover.state === "deferred" && certMode ? `judge: question_discoverability unproven — ${jDiscover.reason} (cert mode)` : "",
    ].filter(Boolean).join("  ·  "),
    band: bandOk ? "pass" : "fail",
    decision_gate_shape: decisionShape.ok ? "pass" : "fail",
    judge_discoverability: jDiscover.state,
  };

  conditions.c_finding_coverage = {
    label: "(c) no missed finding class",
    ok: judgeGate(jCoverage, certMode),
    proven: jCoverage.state === "pass",
    judge: jCoverage.state,
    detail: jCoverage.state === "fail" ? "a seeded finding class was missed"
      : jCoverage.state === "deferred" ? (certMode ? `unproven — ${jCoverage.reason} (cert mode requires a graded judge; --allow-deferred for mechanical-only)` : "deferred (run-day judge)") : "",
  };

  conditions.d_done_claims = {
    label: "(d) every done claim verified",
    ok: closeoutGate.ok && judgeGate(jVerify, certMode),
    detail: [
      closeoutGate.ok ? "" : `faithfulness-trace: ${closeoutGate.detail}`,
      jVerify.state === "fail" ? "judge: verification inadequate" : jVerify.state === "deferred" && certMode ? `judge: verification_adequacy unproven — ${jVerify.reason} (cert mode)` : "",
    ].filter(Boolean).join("  ·  "),
    shape: closeoutGate.ok ? "pass" : "fail",
    judge_verification_adequacy: jVerify.state,
  };

  if (r7Exposure) {
    conditions.r7_exposure_ratification = {
      label: "R7 F41 exposure-ratification",
      ok: r7Exposure.ok,
      mechanical: true,
      applicable: r7Exposure.applicable ? "yes" : "no",
      detail: r7Exposure.detail,
    };
  }

  const floor = {
    floor_pass: comparison.floor_pass,
    regressed: comparison.regressed,
    // Verdict-neutral: a zero-mutation candidate passes verification vacuously (qwen1 class —
    // "green-but-degenerate"); judge dims carry the weight, but the scorecard must say so itself.
    ...(comparison.floor_degenerate ? { degenerate: true, degenerate_reason: comparison.floor_degenerate_reason } : {}),
  };
  const conditionsPass = Object.values(conditions).every((c) => c.ok);
  const verdictPass = conditionsPass && comparison.floor_pass && !comparison.regressed;
  // T3 — a --allow-deferred run can never say PARITY-PASS: a clean run is MECHANICAL-ONLY (exit 3),
  // distinct from a certified parity pass (exit 0), so exit-code-only automation cannot mis-certify.
  const mechanicalOnly = !certMode;
  const verdictLabel = !verdictPass ? "parity-fail" : mechanicalOnly ? "mechanical-only" : "parity-pass";
  const exitCode = !verdictPass ? 1 : mechanicalOnly ? 3 : 0;

  const failed = [
    ...Object.values(conditions).filter((c) => !c.ok).map((c) => c.label),
    ...(comparison.floor_pass ? [] : ["deterministic floor (tool_path / verification / question_economy)"]),
    ...(comparison.regressed ? ["regressed vs golden #2"] : []),
  ];

  const mode = [
    certMode ? "certification (deferred judge dims fail)" : "allow-deferred (mechanical-only)",
    crossModel ? "cert-v2 cross-model: tool_path diagnostic" : "",
    fixtureDiffPath ? "cert-v3: F41 exposure-ratification" : "",
  ].filter(Boolean).join(" · ");

  const scorecard = {
    verdict: verdictLabel,
    fingerprint: baseFp,
    mode,
    candidate: { path: candidatePath, model: cand.trajectory.provenance.model },
    baseline: { path: baselinePath, model: base.trajectory.provenance.model },
    judge_provider: provider.fn ? "supplied" : "none (judge dims deferred)",
    conditions,
    floor,
    parity_predicate: "fingerprint match && no answer-key access && floor_pass && !regressed && operator_asks==1 && decision-ask shape green && (a)&&(d) mechanical green && gating judge dims pass (deferred fails in cert mode; question_discoverability judges fork semantics)" + (fixtureDiffPath ? " && R7 exposure-ratification" : ""),
    failed_conditions: failed,
  };
  if (fixtureDiffPath) scorecard.fixture_diff = fixtureDiffPath;

  if (has("--json")) {
    console.log(JSON.stringify(scorecard, null, 2));
  } else {
    console.log(`Fable-parity scorecard — ${scorecard.verdict.toUpperCase()}   [${scorecard.mode}]`);
    console.log(`  fingerprint: ${scorecard.fingerprint}`);
    console.log(`  candidate ${scorecard.candidate.model}  vs  golden ${scorecard.baseline.model}   [judge: ${scorecard.judge_provider}]`);
    for (const c of Object.values(conditions)) {
      console.log(`  ${c.ok ? "green" : "RED  "}  ${c.label}${c.detail ? `  — ${c.detail}` : ""}`);
    }
    console.log(`  ${floor.floor_pass && !floor.regressed ? (floor.degenerate ? "green-but-DEGENERATE" : "green") : "RED  "}  deterministic floor (floor_pass=${floor.floor_pass}, regressed=${floor.regressed}${floor.degenerate ? `, degenerate: ${floor.degenerate_reason}` : ""})`);
    if (failed.length) console.log(`  failed: ${failed.join("; ")}`);
  }

  process.exit(exitCode);
}

main().catch((e) => { console.error(`score.mjs: ${e.message}`); process.exit(2); });
