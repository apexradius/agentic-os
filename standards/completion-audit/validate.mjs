#!/usr/bin/env node

// validate.mjs — the completion-audit selftest, run bare by the framework harness
// (`validate.mjs --all`). If python3 is absent, every check is SKIPPED with a
// one-line notice and the selftest exits 0 (mirrors session-discipline / design-gate:
// never break a bare-node `--all` run). When python3 is present, the Stop hook is
// exercised against synthetic transcripts in an isolated tmp HOME.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOOK = join(__dirname, 'hooks', 'completion-audit.py');

const checks = [];
const ok = (name, cond, detail = '') => {
  checks.push({ name, pass: !!cond, detail });
  return !!cond;
};
const skip = (name) => {
  checks.push({ name, pass: true, detail: 'SKIPPED — python3 not found' });
};

const report = () => {
  const failed = checks.filter((c) => !c.pass);
  for (const c of checks)
    if (!c.pass) console.log(`  FAIL ${c.name}${c.detail ? `  [${c.detail}]` : ''}`);
  console.log(
    `completion-audit: ${checks.length - failed.length}/${checks.length} selftest checks passed`,
  );
  process.exit(failed.length ? 1 : 0);
};

// ── detect python3 ──────────────────────────────────────────────────────────────
const pyCheck = spawnSync('python3', ['--version'], { encoding: 'utf8' });
if (pyCheck.status !== 0) {
  for (const n of [
    'GREEN: claim + source change + Bash after change → allow, no block',
    'RED core (enforce): claim + source change + no run → block',
    'advisory default: same RED scenario → allow + logs a finding',
    'escape (enforce): named VNA/gap in final text → allow',
    'carve-out (enforce): docs-only change + claim → allow',
    'no-claim (enforce): neutral final message → allow',
    'loop guard (enforce): stop_hook_active → allow',
    'bypass (enforce): bypass flag present → allow',
    'fail-open: missing transcript → allow',
    'fail-open: malformed stdin → allow',
  ])
    skip(n);
  console.log('completion-audit: python3 not found — hook checks skipped');
  report();
}

// ── transcript builders (Claude Code JSONL shape) ────────────────────────────────
const asstTool = (name, input) =>
  JSON.stringify({
    type: 'assistant',
    message: { role: 'assistant', content: [{ type: 'tool_use', name, input }] },
  });
const asstText = (text) =>
  JSON.stringify({
    type: 'assistant',
    message: { role: 'assistant', content: [{ type: 'text', text }] },
  });
const CODE_EDIT = asstTool('Edit', {
  file_path: '/repo/src/app.py',
  old_string: 'a',
  new_string: 'b',
});
const DOC_EDIT = asstTool('Write', { file_path: '/repo/docs/notes.md', content: 'x' });
const BASH_RUN = asstTool('Bash', { command: 'pytest -q' });
const DONE_TEXT = asstText('Done — the fix is complete and shipped.');
const VNA_TEXT = asstText(
  'Done in code, but I could not run the suite this session (VNA: needs CI).',
);
const NEUTRAL_TEXT = asstText('Here is a summary of the options you asked about.');

// ── harness ──────────────────────────────────────────────────────────────────────
let tmpHome;
try {
  tmpHome = mkdtempSync(join(tmpdir(), 'ca-selftest-'));
} catch (e) {
  console.log(`  FAIL could not create tmp HOME: ${e.message}`);
  process.exit(1);
}
const claudeDir = join(tmpHome, '.claude');
mkdirSync(claudeDir, { recursive: true });
const baseEnv = { HOME: tmpHome, PATH: `/usr/bin:/bin:/usr/sbin:/sbin:${process.env.PATH || ''}` };

let tCounter = 0;
function writeTranscript(lines) {
  const p = join(tmpHome, `transcript-${tCounter++}.jsonl`);
  writeFileSync(p, lines.join('\n') + '\n');
  return p;
}
function runHook({
  transcript = null,
  stopHookActive = false,
  enforce = false,
  rawStdin = null,
} = {}) {
  const stdin =
    rawStdin !== null
      ? rawStdin
      : JSON.stringify({ transcript_path: transcript, stop_hook_active: stopHookActive });
  return spawnSync('python3', [HOOK], {
    encoding: 'utf8',
    input: stdin,
    env: { ...baseEnv, ...(enforce ? { OWNERSHIP_AUDIT_ENFORCE: '1' } : {}) },
  });
}
const isBlock = (r) => r.status === 0 && /"decision"\s*:\s*"block"/.test(r.stdout || '');
const isAllow = (r) => r.status === 0 && !/"decision"\s*:\s*"block"/.test(r.stdout || '');

try {
  // GREEN — change, then a Bash run after it, then "done": path was triggered → allow.
  {
    const t = writeTranscript([CODE_EDIT, BASH_RUN, DONE_TEXT]);
    const r = runHook({ transcript: t, enforce: true });
    ok(
      'GREEN: claim + source change + Bash after change → allow, no block',
      isAllow(r),
      `exit ${r.status} stdout=${(r.stdout || '').slice(0, 120)}`,
    );
  }

  // RED core (enforce) — change + "done" but no run afterward → block.
  {
    const t = writeTranscript([CODE_EDIT, DONE_TEXT]);
    const r = runHook({ transcript: t, enforce: true });
    ok(
      'RED core (enforce): claim + source change + no run → block',
      isBlock(r),
      `exit ${r.status} stdout=${(r.stdout || '').slice(0, 160)}`,
    );
  }

  // Advisory default — same RED scenario, no enforce flag → allow, and log a line.
  {
    const logPath = join(claudeDir, 'ownership-audit.log');
    try {
      rmSync(logPath);
    } catch {
      /* fresh */
    }
    const t = writeTranscript([CODE_EDIT, DONE_TEXT]);
    const r = runHook({ transcript: t, enforce: false });
    const logged = existsSync(logPath) && /advisory finding/.test(readFileSync(logPath, 'utf8'));
    ok(
      'advisory default: same RED scenario → allow + logs a finding',
      isAllow(r) && logged,
      `allow=${isAllow(r)} logged=${logged}`,
    );
  }

  // Escape — final text names the gap / VNA → allow even in enforce.
  {
    const t = writeTranscript([CODE_EDIT, VNA_TEXT]);
    const r = runHook({ transcript: t, enforce: true });
    ok(
      'escape (enforce): named VNA/gap in final text → allow',
      isAllow(r),
      `exit ${r.status} stdout=${(r.stdout || '').slice(0, 120)}`,
    );
  }

  // Carve-out — docs-only change + "done": no runtime surface → allow.
  {
    const t = writeTranscript([DOC_EDIT, DONE_TEXT]);
    const r = runHook({ transcript: t, enforce: true });
    ok(
      'carve-out (enforce): docs-only change + claim → allow',
      isAllow(r),
      `exit ${r.status} stdout=${(r.stdout || '').slice(0, 120)}`,
    );
  }

  // No completion claim — neutral final message → allow (nothing claimed).
  {
    const t = writeTranscript([CODE_EDIT, NEUTRAL_TEXT]);
    const r = runHook({ transcript: t, enforce: true });
    ok(
      'no-claim (enforce): neutral final message → allow',
      isAllow(r),
      `exit ${r.status} stdout=${(r.stdout || '').slice(0, 120)}`,
    );
  }

  // Loop guard — stop_hook_active blocks a second consecutive hold.
  {
    const t = writeTranscript([CODE_EDIT, DONE_TEXT]);
    const r = runHook({ transcript: t, enforce: true, stopHookActive: true });
    ok(
      'loop guard (enforce): stop_hook_active → allow',
      isAllow(r),
      `exit ${r.status} stdout=${(r.stdout || '').slice(0, 120)}`,
    );
  }

  // Bypass — flag file short-circuits everything.
  {
    const bypass = join(claudeDir, '.ownership-audit-bypass');
    writeFileSync(bypass, '');
    const t = writeTranscript([CODE_EDIT, DONE_TEXT]);
    const r = runHook({ transcript: t, enforce: true });
    ok(
      'bypass (enforce): bypass flag present → allow',
      isAllow(r),
      `exit ${r.status} stdout=${(r.stdout || '').slice(0, 120)}`,
    );
    rmSync(bypass);
  }

  // Fail-open — missing transcript path → allow.
  {
    const r = runHook({ transcript: join(tmpHome, 'does-not-exist.jsonl'), enforce: true });
    ok('fail-open: missing transcript → allow', isAllow(r), `exit ${r.status}`);
  }

  // Fail-open — malformed stdin → allow.
  {
    const r = runHook({ rawStdin: '{not json', enforce: true });
    ok('fail-open: malformed stdin → allow', isAllow(r), `exit ${r.status}`);
  }
} finally {
  try {
    rmSync(tmpHome, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
}

report();
