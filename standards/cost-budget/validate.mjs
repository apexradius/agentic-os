#!/usr/bin/env node
// validate.mjs — the cost-budget selftest, run bare by the framework harness
// (`validate.mjs --all`). Structural + JS-unit checks always run; python-dependent integration
// checks are SKIPPED with a notice if python3 is absent (mirrors context-budget's ethos — never
// break a bare-node `--all` run). The manifest-driven one-code-path parity check passes
// vacuously on a bare clone (no apex manifest present).

import {
  mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync, readdirSync, statSync, mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { meterTranscript, totalTokens, costUsd } from "./lib/cost.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOOK = join(__dirname, "hooks", "cost-budget-guard.py");
const LIB = join(__dirname, "lib", "cost.mjs");
const EXAMPLES_SETTINGS = join(__dirname, "examples", "settings.json");
const RED = join(__dirname, "fixtures", "red", "over-budget.jsonl");
const GREEN = join(__dirname, "fixtures", "green", "under-budget.jsonl");
const PRICE_MAP = join(__dirname, "fixtures", "price-map.json");
const REPO_ROOT = join(__dirname, "..", "..", "..");

const checks = [];
const ok = (name, cond, detail = "") => { checks.push({ name, pass: !!cond, detail }); return !!cond; };
const skip = (name) => { checks.push({ name, pass: true, detail: "SKIPPED" }); };

// ── structural checks ─────────────────────────────────────────────────────────
ok("hook file exists", existsSync(HOOK), `expected: ${HOOK}`);
ok("lib/cost.mjs exists", existsSync(LIB), `expected: ${LIB}`);
ok("fixtures exist (red, green, price-map)", existsSync(RED) && existsSync(GREEN) && existsSync(PRICE_MAP));

let settingsOk = false;
try {
  const cfg = JSON.parse(readFileSync(EXAMPLES_SETTINGS, "utf8"));
  const h = cfg.hooks || {};
  settingsOk = Array.isArray(h.PreToolUse) && Array.isArray(h.UserPromptSubmit);
} catch { /* stays false */ }
ok("examples/settings.json has PreToolUse + UserPromptSubmit entries", settingsOk);

// ── JS unit: the meter dedups by message.id, the split survives ────────────────
const redText = readFileSync(RED, "utf8");
const redModel = meterTranscript(redText);
const redTotal = totalTokens(redModel);
// deduped: aaa = 100+50+10+40 = 200 (last-wins over 3 lines, not 3x), bbb = 200+100+0+10 = 310.
ok("meter: dedups multi-line message.id (last-wins) → 510, not the 855 naive sum",
  redTotal === 510, `got ${redTotal}`);
const fable = redModel["claude-fable-5"] || {};
ok("meter: preserves the 3-way input split per model",
  fable.input === 300 && fable.cache_read === 150 && fable.cache_creation === 10 && fable.output === 50,
  JSON.stringify(fable));
ok("meter: green corpus totals 60", totalTokens(meterTranscript(readFileSync(GREEN, "utf8"))) === 60);

// ── JS unit: costUsd is per-category (cache_read ≠ input rate) and null-safe ────
const priceMap = JSON.parse(readFileSync(PRICE_MAP, "utf8"));
// hand-computed: 300/1e6*10 + 150/1e6*1 + 10/1e6*12.5 + 50/1e6*50
//              = 0.003 + 0.00015 + 0.000125 + 0.0025 = 0.005775 → round4 0.0058
const dollars = costUsd(redModel, priceMap);
ok("costUsd: per-category $ = 0.0058 (cache_read priced ≠ input)", dollars === 0.0058, `got ${dollars}`);
// prove the category split matters: pricing all 460 input-side tokens at the input rate would be
// 460/1e6*10 + 50/1e6*50 = 0.0046 + 0.0025 = 0.0071 — materially higher than the honest 0.0058.
ok("costUsd: honest split is cheaper than a single-input-bucket $ (0.0058 < 0.0071)", dollars < 0.0071);
ok("costUsd: no price map → null (never fabricates)", costUsd(redModel, null) === null);
ok("costUsd: unmatched model + no default → null",
  costUsd({ "unknown-model": { input: 1, cache_read: 0, cache_creation: 0, output: 1 } }, { "other": { input: 1 } }) === null);

// ── detect python3 ─────────────────────────────────────────────────────────────
const hasPython = spawnSync("python3", ["--version"], { encoding: "utf8" }).status === 0;

if (!hasPython) {
  for (const n of [
    "hook: py_compile clean", "PreToolUse: unknown event → exit 0", "PreToolUse: no session_id → exit 0",
    "PreToolUse: no ceiling → inert (fail-open)", "PreToolUse: over budget → DENY dispatch (Task)",
    "PreToolUse: over budget → ALLOW finish/verify (Read)", "PreToolUse: over budget → ALLOW Bash (porosity)",
    "PreToolUse: under budget → ALLOW dispatch", "PreToolUse: unmeasurable transcript → fail-open",
    "UserPromptSubmit: warn band → advisory (no block)", "UserPromptSubmit: under warn → silent",
    "meter: incremental watermark folds non-tail, excludes tail", "budget ladder: sidecar budget_tokens supplies ceiling",
  ]) skip(n);
  console.log("cost-budget: python3 not found — python-dependent checks skipped");
} else {
  ok("hook: py_compile clean",
    spawnSync("python3", ["-m", "py_compile", HOOK], { encoding: "utf8" }).status === 0);

  let tmpHome;
  try { tmpHome = mkdtempSync(join(tmpdir(), "cost-budget-selftest-")); }
  catch (e) { console.log(`  FAIL tmp HOME: ${e.message}`); process.exit(1); }

  const baseEnv = { HOME: tmpHome, PATH: `/usr/bin:/bin:/usr/sbin:/sbin:${process.env.PATH || ""}` };
  const run = (payload, extraEnv = {}) => spawnSync("python3", [HOOK], {
    encoding: "utf8", input: JSON.stringify(payload), env: { ...process.env, ...baseEnv, ...extraEnv },
  });
  const isDeny = (r) => {
    try { return JSON.parse(r.stdout || "{}")?.hookSpecificOutput?.permissionDecision === "deny"; }
    catch { return false; }
  };
  const OVER = { COSTGUARD_SESSION_TOKENS: "400" };   // < 510 → over budget
  const UNDER = { COSTGUARD_SESSION_TOKENS: "2000" };  // > 510 → under budget

  try {
    ok("PreToolUse: unknown event → exit 0",
      run({ hook_event_name: "Nope", session_id: "s1" }).status === 0);
    ok("PreToolUse: no session_id → exit 0",
      run({ hook_event_name: "PreToolUse", tool_name: "Task", transcript_path: RED }, OVER).status === 0);

    // No ceiling declared → inert even with an over-budget transcript + a dispatch tool.
    const inert = run({ hook_event_name: "PreToolUse", session_id: "s-inert", tool_name: "Task", transcript_path: RED });
    ok("PreToolUse: no ceiling → inert (fail-open)", inert.status === 0 && !isDeny(inert), inert.stdout);

    // Over budget (hard 400 < 510): deny dispatch, allow finish/verify.
    const denyTask = run({ hook_event_name: "PreToolUse", session_id: "s-over-1", tool_name: "Task", transcript_path: RED }, OVER);
    ok("PreToolUse: over budget → DENY dispatch (Task)", isDeny(denyTask), denyTask.stdout.slice(0, 160));
    const allowRead = run({ hook_event_name: "PreToolUse", session_id: "s-over-2", tool_name: "Read", transcript_path: RED }, OVER);
    ok("PreToolUse: over budget → ALLOW finish/verify (Read)", allowRead.status === 0 && !isDeny(allowRead), allowRead.stdout);
    const allowBash = run({ hook_event_name: "PreToolUse", session_id: "s-over-3", tool_name: "Bash", transcript_path: RED }, OVER);
    ok("PreToolUse: over budget → ALLOW Bash (porosity, not containment)", allowBash.status === 0 && !isDeny(allowBash), allowBash.stdout);

    // Under budget (hard 2000 > 510): dispatch flows.
    const allowUnder = run({ hook_event_name: "PreToolUse", session_id: "s-under", tool_name: "Task", transcript_path: RED }, UNDER);
    ok("PreToolUse: under budget → ALLOW dispatch", allowUnder.status === 0 && !isDeny(allowUnder), allowUnder.stdout);

    // Unmeasurable transcript (path missing) → fail-open even over an env ceiling.
    const noTx = run({ hook_event_name: "PreToolUse", session_id: "s-notx", tool_name: "Task", transcript_path: join(tmpHome, "nope.jsonl") }, OVER);
    ok("PreToolUse: unmeasurable transcript → fail-open", noTx.status === 0 && !isDeny(noTx), noTx.stdout);

    // Warn band: 510/700 = 72.8% ≥ 70 → advisory fires; it is NOT a deny (UserPromptSubmit can't deny).
    const warn = run({ hook_event_name: "UserPromptSubmit", session_id: "s-warn", transcript_path: RED }, { COSTGUARD_SESSION_TOKENS: "700", COSTGUARD_PRICE_MAP: PRICE_MAP });
    let warnHasCtx = false, warnHasDollars = false;
    try {
      const c = JSON.parse(warn.stdout || "{}")?.hookSpecificOutput?.additionalContext || "";
      warnHasCtx = c.includes("cost-budget") && c.includes("73%");
      warnHasDollars = c.includes("$");
    } catch { /* false */ }
    ok("UserPromptSubmit: warn band → advisory (no block)", warn.status === 0 && warnHasCtx && warnHasDollars, warn.stdout.slice(0, 200));

    // Under warn: 510/5000 = 10.2% < 70 → silent.
    const quiet = run({ hook_event_name: "UserPromptSubmit", session_id: "s-quiet", transcript_path: RED }, { COSTGUARD_SESSION_TOKENS: "5000" });
    ok("UserPromptSubmit: under warn → silent", quiet.status === 0 && (quiet.stdout || "") === "", quiet.stdout);

    // Incremental watermark: after one PreToolUse the sidecar folds the non-tail message (msg-aaa=200)
    // into committed and excludes the still-growing tail (msg-bbb), rewinding the offset to its start.
    const wmSession = "s-wm";
    run({ hook_event_name: "PreToolUse", session_id: wmSession, tool_name: "Read", transcript_path: RED }, OVER);
    let wmOk = false;
    try {
      const sc = JSON.parse(readFileSync(join(tmpHome, ".claude", "session-env", wmSession, "cost-budget.json"), "utf8"));
      const committedTotal = Object.values(sc.committed || {}).reduce((t, v) => t + v.input + v.cache_read + v.cache_creation + v.output, 0);
      wmOk = committedTotal === 200 && sc.offset > 0 && sc.offset < statSync(RED).size;
    } catch { /* false */ }
    ok("meter: incremental watermark folds non-tail (200), excludes tail, offset rewound", wmOk);

    // Budget ladder: a session sidecar budget_tokens supplies the ceiling with NO env ceiling
    // (the seam an orchestrator / 7.7 writes a per-node budget into).
    const ladderSession = "s-ladder";
    mkdirSync(join(tmpHome, ".claude", "session-env", ladderSession), { recursive: true });
    writeFileSync(join(tmpHome, ".claude", "session-env", ladderSession, "cost-budget.json"),
      JSON.stringify({ offset: 0, committed: {}, budget_tokens: 400 }));
    const ladderDeny = run({ hook_event_name: "PreToolUse", session_id: ladderSession, tool_name: "Task", transcript_path: RED });
    ok("budget ladder: sidecar budget_tokens supplies ceiling (no env)", isDeny(ladderDeny), ladderDeny.stdout.slice(0, 160));
  } finally {
    try { rmSync(tmpHome, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

// ── manifest-driven one-code-path parity (instance; vacuous on a bare clone) ────
// Closes the copy-drift gap the sibling context-budget leaves open: the deployed instance hook,
// with its env-var rebrand reversed, must be byte-identical to this framework hook.
function findManifest(root) {
  const skipDirs = new Set(["node_modules", ".git", "venv", "__pycache__", "dist", "build"]);
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let ents;
    try { ents = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const ent of ents) {
      if (ent.isDirectory()) { if (!skipDirs.has(ent.name)) stack.push(join(dir, ent.name)); }
      else if (ent.name === "cost-budget.manifest.json") return join(dir, ent.name);
    }
  }
  return null;
}
const manifestPath = findManifest(REPO_ROOT);
if (!manifestPath) {
  skip("one-code-path: deployed hook == framework hook (modulo env rebrand)");
} else {
  let parityOk = false, detail = "";
  try {
    const m = JSON.parse(readFileSync(manifestPath, "utf8"));
    const deployed = m.deployed_hook ? m.deployed_hook.replace(/^~/, process.env.HOME || "~") : "";
    const rebrand = m.env_rebrand || {};
    if (!existsSync(deployed)) {
      detail = `deployed hook not present (${deployed}) — instance-only, treated vacuous`;
      parityOk = true; // a bare clone / another machine won't have the deployed copy
    } else {
      let dep = readFileSync(deployed, "utf8");
      // reverse the instance rebrand: APEX_COST_* -> COSTGUARD_*, then drop the docstring name line
      for (const [fw, inst] of Object.entries(rebrand)) dep = dep.split(inst).join(fw);
      const norm = (s) => s.split("\n").filter((l) => !/-guard\.py — /.test(l) && !/guard\.py$/.test(l.trim())).join("\n");
      parityOk = norm(dep) === norm(readFileSync(HOOK, "utf8"));
      detail = parityOk ? "" : "deployed hook diverges from framework hook after rebrand-reversal";
    }
  } catch (e) { detail = `manifest/parity error: ${e.message}`; }
  ok("one-code-path: deployed hook == framework hook (modulo env rebrand)", parityOk, detail);
}

// ── report ──────────────────────────────────────────────────────────────────────
const failed = checks.filter((c) => !c.pass);
for (const c of checks) if (!c.pass) console.log(`  FAIL ${c.name}${c.detail ? `  [${c.detail}]` : ""}`);
console.log(`cost-budget: ${checks.length - failed.length}/${checks.length} selftest checks passed`);
process.exit(failed.length ? 1 : 0);
