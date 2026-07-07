#!/usr/bin/env node
// validate.mjs — the session-discipline selftest, run bare by the framework harness
// (`validate.mjs --all`). If python3 is absent, each integration check is SKIPPED
// with a one-line notice and the selftest exits 0 (mirrors design-gate's ethos of
// never breaking a bare-node `--all` run). When python3 is present, all 4 hooks
// are exercised against an isolated tmp HOME.

import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOOKS_DIR = join(__dirname, "hooks");

const checks = [];
const ok = (name, cond, detail = "") => { checks.push({ name, pass: !!cond, detail }); return !!cond; };
const skip = (name) => { checks.push({ name, pass: true, detail: "SKIPPED — python3 not found" }); };

// ── mcp-cleanup.sh: pure bash (no python3) — exercise it unconditionally ──────
// Safety: only ever run it UNCONFIGURED (pure no-op) or CONFIGURED-BUT-NO-MATCH.
// We never hand it a pattern that matches a real process, so the selftest cannot
// kill anything. Both invocations must exit 0 and reap nothing.
{
  const mcpHook = join(HOOKS_DIR, "mcp-cleanup.sh");
  const noopRun = spawnSync("bash", [mcpHook], {
    encoding: "utf8",
    env: { ...process.env, MCP_CLEANUP_PATTERN: "", MCP_CLEANUP_NAMES: "", MCP_CLEANUP_NPM_SCOPE: "" },
  });
  ok("mcp-cleanup.sh: unconfigured → clean no-op exit 0", noopRun.status === 0,
    `exit ${noopRun.status}\n${noopRun.stderr}`);
  const nomatch = `__ska_selftest_nomatch_${process.pid}__`;
  const cfgRun = spawnSync("bash", [mcpHook], {
    encoding: "utf8",
    env: { ...process.env, MCP_CLEANUP_PATTERN: nomatch, MCP_CLEANUP_NAMES: nomatch, MCP_CLEANUP_NPM_SCOPE: nomatch },
  });
  ok("mcp-cleanup.sh: configured-but-no-match → exit 0, reaps nothing", cfgRun.status === 0,
    `exit ${cfgRun.status}\n${cfgRun.stderr}`);
}

// ── detect python3 ────────────────────────────────────────────────────────────
const pyCheck = spawnSync("python3", ["--version"], { encoding: "utf8" });
const hasPython = pyCheck.status === 0;

if (!hasPython) {
  skip("session-start.sh: creates SESSION file and pointer");
  skip("planning-gate.sh: exits 2 when planning block absent");
  skip("planning-gate.sh: exits 0 after valid planning block written");
  skip("read-only-gate.sh with discovery flag: Edit to non-sessions path → exit 2");
  skip("read-only-gate.sh with discovery flag: Edit to sessions path → exit 0");
  skip("read-only-gate.sh with discovery flag: Bash ls → exit 0");
  skip("read-only-gate.sh with discovery flag: Bash rm -rf → exit 2");
  skip("read-only-gate.sh without discovery flag: Edit → exit 0");
  skip("session-close.sh: archives populated session, removes pointer");
  skip("secret-guard.py: denies bare op read with stderr contract");
  skip("secret-guard.py: denies op item get --reveal");
  skip("secret-guard.py: denies non-assignment command substitution");
  skip("secret-guard.py: denies command after &&");
  skip("secret-guard.py: denies command after wrapper");
  skip("secret-guard.py: denies unbalanced quoted prose via fallback");
  skip("secret-guard.py: denies double-quoted command substitution");
  skip("secret-guard.py: denies double-quoted backtick substitution via fallback");
  skip("secret-guard.py: denies command substitution inside commit message");
  skip("secret-guard.py: allows assignment capture before curl");
  skip("secret-guard.py: allows double-quoted assignment capture");
  skip("secret-guard.py: allows commit-message prose");
  skip("secret-guard.py: allows multiline quoted commit-message prose");
  skip("secret-guard.py: allows git grep prose");
  skip("secret-guard.py: allows non-Bash payload");
  skip("secret-guard.py: allows captured first line plus clean second line");
  skip("secret-guard.py: allows single-quoted literal command substitution prose");
  console.log("session-discipline: python3 not found — python-dependent checks skipped");
  const f0 = checks.filter((c) => !c.pass);
  for (const c of f0) console.log(`  FAIL ${c.name}${c.detail ? `  [${c.detail}]` : ""}`);
  console.log(`session-discipline: ${checks.length - f0.length}/${checks.length} selftest checks passed`);
  process.exit(f0.length ? 1 : 0);
}

// ── helper: spawn a hook with an isolated HOME ────────────────────────────────
function runHook(hookName, opts = {}) {
  const {
    env = {},
    stdin = null,
  } = opts;
  const hookPath = join(HOOKS_DIR, hookName);
  const result = spawnSync("bash", [hookPath], {
    encoding: "utf8",
    input: stdin !== null ? stdin : undefined,
    env: { ...process.env, ...env },
  });
  return result;
}

function runPythonHook(hookName, opts = {}) {
  const {
    env = {},
    stdin = null,
  } = opts;
  const hookPath = join(HOOKS_DIR, hookName);
  return spawnSync("python3", [hookPath], {
    encoding: "utf8",
    input: stdin !== null ? stdin : undefined,
    env: { ...process.env, ...env },
  });
}

// ── set up an isolated tmp HOME ───────────────────────────────────────────────
let tmpHome;
try {
  tmpHome = mkdtempSync(join(tmpdir(), "ska-selftest-"));
} catch (e) {
  console.log(`  FAIL could not create tmp HOME: ${e.message}`);
  process.exit(1);
}

const runId = `selftest-${process.pid}-${Date.now()}`;
const sessionsDir = join(tmpHome, ".claude", "sessions");
const archiveDir = join(sessionsDir, "archive");
const pointerFile = join(sessionsDir, ".current-session");
const discoveryFlag = join(tmpHome, ".claude", ".discovery-mode");
// Prepend system paths so hooks find the real python3, not version-manager shims
// (e.g. mise, pyenv) that require the real HOME to resolve their config.
const baseEnv = {
  HOME: tmpHome,
  PATH: `/usr/bin:/bin:/usr/sbin:/sbin:${process.env.PATH || ""}`,
};

try {

  // ── secret-guard.py ─────────────────────────────────────────────────────────
  const bashPayload = (command) => JSON.stringify({ tool_name: "Bash", tool_input: { command } });
  const runSecretGuard = (payload) => runPythonHook("secret-guard.py", {
    env: { ...baseEnv },
    stdin: typeof payload === "string" ? payload : JSON.stringify(payload),
  });

  const bareOpRead = runSecretGuard(bashPayload("op read op://vault/item/field"));
  ok("secret-guard.py: denies bare op read with stderr contract",
    bareOpRead.status === 2 && bareOpRead.stderr.includes("BLOCKED") && bareOpRead.stdout === "",
    `exit ${bareOpRead.status}\nstdout: ${JSON.stringify(bareOpRead.stdout)}\nstderr: ${bareOpRead.stderr.slice(0, 160)}`);

  const reveal = runSecretGuard(bashPayload("op item get abc123 --reveal"));
  ok("secret-guard.py: denies op item get --reveal",
    reveal.status === 2,
    `exit ${reveal.status}\nstderr: ${reveal.stderr.slice(0, 160)}`);

  const substitution = runSecretGuard(bashPayload("echo $(op read op://v/i/f)"));
  ok("secret-guard.py: denies non-assignment command substitution",
    substitution.status === 2,
    `exit ${substitution.status}\nstderr: ${substitution.stderr.slice(0, 160)}`);

  const afterAnd = runSecretGuard(bashPayload("true && op read op://v/i/f"));
  ok("secret-guard.py: denies command after &&",
    afterAnd.status === 2,
    `exit ${afterAnd.status}\nstderr: ${afterAnd.stderr.slice(0, 160)}`);

  const wrapper = runSecretGuard(bashPayload("sudo op read op://v/i/f"));
  ok("secret-guard.py: denies command after wrapper",
    wrapper.status === 2,
    `exit ${wrapper.status}\nstderr: ${wrapper.stderr.slice(0, 160)}`);

  const unbalanced = runSecretGuard(bashPayload('git commit -m "op read op://x'));
  ok("secret-guard.py: denies unbalanced quoted prose via fallback",
    unbalanced.status === 2,
    `exit ${unbalanced.status}\nstderr: ${unbalanced.stderr.slice(0, 160)}`);

  const doubleQuotedSubstitution = runSecretGuard(bashPayload('echo "$(op read op://v/i/f)"'));
  ok("secret-guard.py: denies double-quoted command substitution",
    doubleQuotedSubstitution.status === 2,
    `exit ${doubleQuotedSubstitution.status}\nstderr: ${doubleQuotedSubstitution.stderr.slice(0, 160)}`);

  const doubleQuotedBacktick = runSecretGuard(bashPayload('echo "`op read op://v/i/f`"'));
  ok("secret-guard.py: denies double-quoted backtick substitution via fallback",
    doubleQuotedBacktick.status === 2,
    `exit ${doubleQuotedBacktick.status}\nstderr: ${doubleQuotedBacktick.stderr.slice(0, 160)}`);

  const commitExpansion = runSecretGuard(bashPayload('git commit -m "see $(op read op://v/i/f)"'));
  ok("secret-guard.py: denies command substitution inside commit message",
    commitExpansion.status === 2,
    `exit ${commitExpansion.status}\nstderr: ${commitExpansion.stderr.slice(0, 160)}`);

  const capturedCurl = runSecretGuard(bashPayload('PASS=$(op read op://v/i/f) && curl -u "u:$PASS" https://x'));
  ok("secret-guard.py: allows assignment capture before curl",
    capturedCurl.status === 0,
    `exit ${capturedCurl.status}\nstderr: ${capturedCurl.stderr.slice(0, 160)}`);

  const doubleQuotedCapture = runSecretGuard(bashPayload('VAR="$(op read op://v/i/f)"'));
  ok("secret-guard.py: allows double-quoted assignment capture",
    doubleQuotedCapture.status === 0,
    `exit ${doubleQuotedCapture.status}\nstderr: ${doubleQuotedCapture.stderr.slice(0, 160)}`);

  const commitProse = runSecretGuard(bashPayload('git commit -m "docs: mention op read op://example in prose"'));
  ok("secret-guard.py: allows commit-message prose",
    commitProse.status === 0,
    `exit ${commitProse.status}\nstderr: ${commitProse.stderr.slice(0, 160)}`);

  const multilineCommit = runSecretGuard(bashPayload('git commit -m "line one\nprose about op read op://x\nline three"'));
  ok("secret-guard.py: allows multiline quoted commit-message prose",
    multilineCommit.status === 0,
    `exit ${multilineCommit.status}\nstderr: ${multilineCommit.stderr.slice(0, 160)}`);

  const grepProse = runSecretGuard(bashPayload('git log --grep "op read"'));
  ok("secret-guard.py: allows git grep prose",
    grepProse.status === 0,
    `exit ${grepProse.status}\nstderr: ${grepProse.stderr.slice(0, 160)}`);

  const nonBash = runSecretGuard({
    tool_name: "Write",
    tool_input: { file_path: "/tmp/secret-guard-selftest.txt", content: "op read op://v/i/f" },
  });
  ok("secret-guard.py: allows non-Bash payload",
    nonBash.status === 0,
    `exit ${nonBash.status}\nstderr: ${nonBash.stderr.slice(0, 160)}`);

  const capturedFirstLine = runSecretGuard(bashPayload("FOO=$(op read op://v/i/f)\necho done"));
  ok("secret-guard.py: allows captured first line plus clean second line",
    capturedFirstLine.status === 0,
    `exit ${capturedFirstLine.status}\nstderr: ${capturedFirstLine.stderr.slice(0, 160)}`);

  const singleQuotedLiteral = runSecretGuard(bashPayload("echo 'literal $(op read op://x) prose'"));
  ok("secret-guard.py: allows single-quoted literal command substitution prose",
    singleQuotedLiteral.status === 0,
    `exit ${singleQuotedLiteral.status}\nstderr: ${singleQuotedLiteral.stderr.slice(0, 160)}`);

  // ── 1. session-start.sh ────────────────────────────────────────────────────
  // Force a fresh session with a per-run id. The isolated HOME already prevents
  // real-session writes; the unique id prevents concurrent selftests from ever
  // sharing fixture names inside that HOME.
  const startResult = runHook("session-start.sh", {
    env: { ...baseEnv, CLAUDE_SESSION_ID: runId },
  });

  const sessionFiles = existsSync(sessionsDir)
    ? readdirSync(sessionsDir).filter((f) => f.startsWith("SESSION-") && f.endsWith(".md"))
    : [];
  const pointerExists = existsSync(pointerFile);

  ok("session-start.sh: exits 0", startResult.status === 0,
    `exit ${startResult.status}\n${startResult.stderr}`);
  ok("session-start.sh: creates SESSION-*.md file", sessionFiles.length > 0,
    `files in sessions dir: ${sessionFiles.join(", ") || "(none)"}`);
  ok("session-start.sh: creates .current-session pointer", pointerExists,
    `pointer at ${pointerFile}`);

  // Determine session file path
  const sessionFilename = pointerExists
    ? readFileSync(pointerFile, "utf8").trim()
    : sessionFiles[0] || "";
  const sessionFile = join(sessionsDir, sessionFilename);

  // ── 2. planning-gate.sh — no planning block → exit 2 ─────────────────────
  // Feed a minimal PreToolUse-style JSON payload on stdin
  const noBlockInput = JSON.stringify({ tool_name: "Edit", tool_input: { file_path: "/tmp/foo.py" } });
  const gateNoBlock = runHook("planning-gate.sh", {
    env: { ...baseEnv },
    stdin: noBlockInput,
  });
  ok("planning-gate.sh: exits 2 when planning block absent",
    gateNoBlock.status === 2,
    `exit ${gateNoBlock.status}\nstdout: ${gateNoBlock.stdout.slice(0, 120)}`);

  // ── 3. planning-gate.sh — write valid block → exit 0 ─────────────────────
  const planningBlock = `
ASSUMPTIONS:
- The file format is UTF-8 encoded plain text (verified by file command)
- The target function uses synchronous I/O throughout (no async callbacks present)
- Error handling returns early with a non-zero exit code (consistent with existing callers)

UNKNOWNS:
- Whether the config loader caches the result across invocations

VERIFICATION_PLAN:
- Run the existing test suite and confirm zero regressions
`;
  // Append planning block to the session file
  if (existsSync(sessionFile)) {
    const { appendFileSync } = await import("node:fs");
    appendFileSync(sessionFile, planningBlock, "utf8");
  }

  const gateWithBlock = runHook("planning-gate.sh", {
    env: { ...baseEnv },
    stdin: noBlockInput,
  });
  ok("planning-gate.sh: exits 0 after valid planning block written",
    gateWithBlock.status === 0,
    `exit ${gateWithBlock.status}\nstdout: ${gateWithBlock.stdout.slice(0, 120)}`);

  // ── 4. read-only-gate.sh — with discovery flag ────────────────────────────
  // Create the discovery mode flag
  mkdirSync(join(tmpHome, ".claude"), { recursive: true });
  writeFileSync(discoveryFlag, "");

  // 4a. Edit to a non-sessions path → should exit 2
  const editNonSession = JSON.stringify({
    tool_name: "Edit",
    tool_input: { file_path: "/tmp/somefile.py", old_string: "a", new_string: "b" },
  });
  const roEditBlocked = runHook("read-only-gate.sh", {
    env: { ...baseEnv },
    stdin: editNonSession,
  });
  ok("read-only-gate.sh with discovery flag: Edit to non-sessions path → exit 2",
    roEditBlocked.status === 2,
    `exit ${roEditBlocked.status}`);

  // 4b. Edit to sessions path → should exit 0
  const editSession = JSON.stringify({
    tool_name: "Edit",
    tool_input: { file_path: join(sessionsDir, `SESSION-${runId}.md`), old_string: "a", new_string: "b" },
  });
  const roEditAllowed = runHook("read-only-gate.sh", {
    env: { ...baseEnv },
    stdin: editSession,
  });
  ok("read-only-gate.sh with discovery flag: Edit to sessions path → exit 0",
    roEditAllowed.status === 0,
    `exit ${roEditAllowed.status}`);

  // 4c. Bash ls -la → read-only, should exit 0
  const bashLs = JSON.stringify({
    tool_name: "Bash",
    tool_input: { command: "ls -la /tmp" },
  });
  const roBashAllowed = runHook("read-only-gate.sh", {
    env: { ...baseEnv },
    stdin: bashLs,
  });
  ok("read-only-gate.sh with discovery flag: Bash ls → exit 0",
    roBashAllowed.status === 0,
    `exit ${roBashAllowed.status}`);

  // 4d. Bash rm -rf foo → destructive, should exit 2
  const bashRm = JSON.stringify({
    tool_name: "Bash",
    tool_input: { command: "rm -rf foo" },
  });
  const roBashBlocked = runHook("read-only-gate.sh", {
    env: { ...baseEnv },
    stdin: bashRm,
  });
  ok("read-only-gate.sh with discovery flag: Bash rm -rf → exit 2",
    roBashBlocked.status === 2,
    `exit ${roBashBlocked.status}`);

  // ── 5. read-only-gate.sh — without discovery flag ─────────────────────────
  // Remove the flag
  try { rmSync(discoveryFlag); } catch { /* already gone */ }

  const editWithoutFlag = runHook("read-only-gate.sh", {
    env: { ...baseEnv },
    stdin: editNonSession,
  });
  ok("read-only-gate.sh without discovery flag: Edit → exit 0",
    editWithoutFlag.status === 0,
    `exit ${editWithoutFlag.status}`);

  // ── 6. session-close.sh ───────────────────────────────────────────────────
  // Restore discovery flag to confirm it gets cleaned up
  writeFileSync(discoveryFlag, "");

  const closeResult = runHook("session-close.sh", {
    env: { ...baseEnv, SKA_FORCE_SESSION_CLOSE: "1" },
  });
  ok("session-close.sh: exits 0", closeResult.status === 0,
    `exit ${closeResult.status}\n${closeResult.stderr}`);

  // Populated session should have been archived (had ASSUMPTIONS in it)
  const archivedFiles = existsSync(archiveDir)
    ? readdirSync(archiveDir).filter((f) => f.endsWith(".md"))
    : [];
  ok("session-close.sh: archives populated session into sessions/archive/",
    archivedFiles.length > 0,
    `archive dir: ${archiveDir}, files: ${archivedFiles.join(", ") || "(none)"}`);

  // Pointer should be removed
  ok("session-close.sh: removes .current-session pointer",
    !existsSync(pointerFile),
    `pointer still exists at ${pointerFile}`);

  // Discovery flag should be cleaned up
  ok("session-close.sh: removes .discovery-mode flag",
    !existsSync(discoveryFlag),
    `discovery flag still exists at ${discoveryFlag}`);

} finally {
  try { rmSync(tmpHome, { recursive: true, force: true }); } catch { /* best effort */ }
}

// ── report ────────────────────────────────────────────────────────────────────
const failed = checks.filter((c) => !c.pass);
for (const c of checks) {
  if (!c.pass) console.log(`  FAIL ${c.name}${c.detail ? `  [${c.detail}]` : ""}`);
}
const passCount = checks.length - failed.length;
console.log(`session-discipline: ${passCount}/${checks.length} selftest checks passed`);
process.exit(failed.length ? 1 : 0);
