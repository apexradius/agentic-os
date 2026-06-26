#!/usr/bin/env node
// validate.mjs — the context-budget selftest, run bare by the framework harness
// (`validate.mjs --all`). If python3 is absent, each integration check is SKIPPED
// with a one-line notice and the selftest exits 0 (mirrors session-discipline's
// ethos of never breaking a bare-node `--all` run). When python3 is present, all
// event branches are exercised against an isolated tmp HOME.

import { mkdtempSync, writeFileSync, rmSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOOK = join(__dirname, "hooks", "context-budget-guard.py");
const EXAMPLES_SETTINGS = join(__dirname, "examples", "settings.json");

const checks = [];
const ok = (name, cond, detail = "") => { checks.push({ name, pass: !!cond, detail }); return !!cond; };
const skip = (name) => { checks.push({ name, pass: true, detail: "SKIPPED — python3 not found" }); };

// ── structural checks (no python3 needed) ────────────────────────────────────

ok("hook file exists", existsSync(HOOK), `expected: ${HOOK}`);
ok("examples/settings.json exists", existsSync(EXAMPLES_SETTINGS), `expected: ${EXAMPLES_SETTINGS}`);

// Validate examples/settings.json shape: must have hooks with the four events
let settingsOk = false;
try {
  const { readFileSync } = await import("node:fs");
  const cfg = JSON.parse(readFileSync(EXAMPLES_SETTINGS, "utf8"));
  const hooks = cfg.hooks || {};
  settingsOk = (
    Array.isArray(hooks.PreToolUse) &&
    Array.isArray(hooks.PostToolUse) &&
    Array.isArray(hooks.UserPromptSubmit) &&
    Array.isArray(hooks.PreCompact)
  );
} catch { /* settingsOk stays false */ }
ok("examples/settings.json has all four event entries", settingsOk);

// ── detect python3 ────────────────────────────────────────────────────────────
const pyCheck = spawnSync("python3", ["--version"], { encoding: "utf8" });
const hasPython = pyCheck.status === 0;

if (!hasPython) {
  skip("hook: py_compile clean");
  skip("PreToolUse: unknown event → exit 0 (fail-open)");
  skip("PreToolUse: no session_id → exit 0 (fail-open)");
  skip("PostToolUse: no session_id → exit 0 (fail-open)");
  skip("PostToolUse: small result → no offload");
  skip("PostToolUse: large result → offloads file + emits pointer");
  skip("UserPromptSubmit: no session_id → exit 0 (fail-open)");
  skip("PreCompact: no handoff file → exit 0 (fail-open)");
  console.log("context-budget: python3 not found — python-dependent checks skipped");
} else {
  // ── py_compile check ────────────────────────────────────────────────────────
  const compileResult = spawnSync("python3", ["-m", "py_compile", HOOK], { encoding: "utf8" });
  ok("hook: py_compile clean", compileResult.status === 0,
    `exit ${compileResult.status}\n${compileResult.stderr}`);

  // ── helper: run the hook with given event payload + isolated HOME ────────────
  let tmpHome;
  try {
    tmpHome = mkdtempSync(join(tmpdir(), "ctx-budget-selftest-"));
  } catch (e) {
    console.log(`  FAIL could not create tmp HOME: ${e.message}`);
    process.exit(1);
  }

  // Prepend system paths so hooks find the real python3, not version-manager shims
  // (e.g. mise, pyenv) that require the real HOME to resolve their config.
  const baseEnv = {
    HOME: tmpHome,
    PATH: `/usr/bin:/bin:/usr/sbin:/sbin:${process.env.PATH || ""}`,
  };

  function runHook(payload, extraEnv = {}) {
    return spawnSync("python3", [HOOK], {
      encoding: "utf8",
      input: JSON.stringify(payload),
      env: { ...process.env, ...baseEnv, ...extraEnv },
    });
  }

  try {
    // ── 1. Unknown event → exit 0 (fail-open) ──────────────────────────────────
    const r1 = runHook({ hook_event_name: "UnknownEvent", session_id: "test001" });
    ok("PreToolUse: unknown event → exit 0 (fail-open)", r1.status === 0,
      `exit ${r1.status}\n${r1.stderr}`);

    // ── 2. PreToolUse: no session_id → exit 0 ──────────────────────────────────
    const r2 = runHook({ hook_event_name: "PreToolUse" });
    ok("PreToolUse: no session_id → exit 0 (fail-open)", r2.status === 0,
      `exit ${r2.status}\n${r2.stderr}`);

    // ── 3. PostToolUse: no session_id → exit 0 ─────────────────────────────────
    const r3 = runHook({
      hook_event_name: "PostToolUse",
      tool_name: "Write",
      tool_input: { file_path: "/tmp/HANDOFF.md" },
    });
    ok("PostToolUse: no session_id → exit 0 (fail-open)", r3.status === 0,
      `exit ${r3.status}\n${r3.stderr}`);

    // ── 3b. PostToolUse: small result stays inline/no output ───────────────────
    const small = runHook({
      hook_event_name: "PostToolUse",
      session_id: "test001",
      tool_name: "Read",
      tool_response: "small payload",
    }, { CTXGUARD_OFFLOAD_CHARS: "20", CTXGUARD_OFFLOAD_PREVIEW_CHARS: "8" });
    ok("PostToolUse: small result → exit 0", small.status === 0,
      `exit ${small.status}\n${small.stderr}`);
    ok("PostToolUse: small result → no offload", (small.stdout || "") === "",
      `stdout: ${small.stdout.slice(0, 120)}`);

    // ── 3c. PostToolUse: large result writes session-local file + pointer ──────
    const largePayload = "X".repeat(60);
    const large = runHook({
      hook_event_name: "PostToolUse",
      session_id: "test001",
      tool_name: "Read",
      tool_response: largePayload,
    }, { CTXGUARD_OFFLOAD_CHARS: "20", CTXGUARD_OFFLOAD_PREVIEW_CHARS: "10" });
    ok("PostToolUse: large result → exit 0", large.status === 0,
      `exit ${large.status}\n${large.stderr}`);
    const offloadDir = join(tmpHome, ".claude", "session-env", "test001", "tool-results");
    const offloaded = existsSync(offloadDir)
      ? readdirSync(offloadDir).filter((f) => f.endsWith(".txt"))
      : [];
    const offloadFile = offloaded.length ? join(offloadDir, offloaded[0]) : "";
    let largeHasPointer = false;
    try {
      const out = JSON.parse(large.stdout || "{}");
      const ctx = out.hookSpecificOutput && out.hookSpecificOutput.additionalContext;
      largeHasPointer = typeof ctx === "string" && ctx.includes(offloadFile) && ctx.includes("Preview:");
    } catch { /* largeHasPointer stays false */ }
    ok("PostToolUse: large result → offloads file + emits pointer",
      offloadFile && existsSync(offloadFile) && statSync(offloadFile).size === largePayload.length && largeHasPointer,
      `stdout: ${large.stdout.slice(0, 160)}`);

    // ── 4. UserPromptSubmit: no session_id → exit 0 ────────────────────────────
    const r4 = runHook({ hook_event_name: "UserPromptSubmit" });
    ok("UserPromptSubmit: no session_id → exit 0 (fail-open)", r4.status === 0,
      `exit ${r4.status}\n${r4.stderr}`);

    // ── 5. PreCompact: no handoff file → exit 0 ────────────────────────────────
    const r5 = runHook({ hook_event_name: "PreCompact", session_id: "test001" });
    ok("PreCompact: no handoff file → exit 0 (fail-open)", r5.status === 0,
      `exit ${r5.status}\n${r5.stderr}`);

    // ── 6. PreCompact: with handoff file → injects additionalContext ────────────
    const sessionDir = join(tmpHome, ".claude", "session-env", "test001");
    mkdirSync(sessionDir, { recursive: true });
    const handoffPath = join(sessionDir, "HANDOFF.md");
    writeFileSync(handoffPath, "# Session Handoff\n\n## Goal\nTest the PreCompact branch.\n");

    const r6 = runHook({ hook_event_name: "PreCompact", session_id: "test001" });
    ok("PreCompact: with handoff file → exit 0", r6.status === 0,
      `exit ${r6.status}\n${r6.stderr}`);
    let r6HasContext = false;
    try {
      const out = JSON.parse(r6.stdout || "{}");
      r6HasContext = !!(out.hookSpecificOutput && out.hookSpecificOutput.additionalContext);
    } catch { /* r6HasContext stays false */ }
    ok("PreCompact: with handoff file → emits additionalContext", r6HasContext,
      `stdout: ${r6.stdout.slice(0, 120)}`);

  } finally {
    try { rmSync(tmpHome, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

// ── report ────────────────────────────────────────────────────────────────────
const failed = checks.filter((c) => !c.pass);
for (const c of checks) {
  if (!c.pass) console.log(`  FAIL ${c.name}${c.detail ? `  [${c.detail}]` : ""}`);
}
const passCount = checks.length - failed.length;
console.log(`context-budget: ${passCount}/${checks.length} selftest checks passed`);
process.exit(failed.length ? 1 : 0);
