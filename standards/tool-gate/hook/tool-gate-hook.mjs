#!/usr/bin/env node
// tool-gate-hook.mjs — PreToolUse hook that runs the deterministic tool gate before a call
// executes. Wire it in a runtime config (per framework/primitives/hooks/spec.md), e.g.
// .claude/settings.json:
//
//   { "hooks": { "PreToolUse": [ {
//       "matcher": "Bash|Write|Edit",
//       "hooks": [ { "type": "command",
//         "command": "node ${CLAUDE_PROJECT_DIR}/framework/standards/tool-gate/hook/tool-gate-hook.mjs",
//         "timeout": 10 } ] } ] } }
//
// Reads the PreToolUse event JSON on stdin ({ tool_name, tool_input, … }) and emits the
// permission decision JSON the runtime expects. deny → block, ask → prompt the human,
// allow → pre-clear. Fail-OPEN on its own error (never wedge the agent over a gate bug);
// the gate is a safety net, not the only line of defense.

import { decide } from '../gate.mjs';
import { auditDecision } from '../lib/audit.mjs';

function emit(permissionDecision, reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision, // "allow" | "deny" | "ask"
        permissionDecisionReason: reason,
      },
    }),
  );
  process.exit(0);
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (raw += c));
// Tools that can touch the system. If the gate ERRORS on one of these, we fail closed to a
// human prompt rather than silently allowing — the safer-by-default posture this gate exists for.
const SYSTEM_TOUCHING = /^(Bash|Write|Edit|NotebookEdit)$/;

process.stdin.on('end', () => {
  let event;
  try {
    event = JSON.parse(raw || '{}');
  } catch (err) {
    // Can't even parse the event → nothing to gate on; fail open so a malformed event from the
    // runtime never wedges the agent.
    return emit('allow', `tool-gate skipped (unparseable event: ${err.message})`);
  }
  try {
    const result = decide(event);
    const { decision, reason, findings } = result;
    auditDecision(result); // opt-in (TOOLGATE_AUDIT_LOG), fail-open, redacted — never blocks the call
    const detail = findings.length
      ? `${reason} [${findings.map((f) => f.rule).join(', ')}]`
      : reason;
    if (decision === 'deny') return emit('deny', `tool-gate blocked this call: ${detail}`);
    if (decision === 'ask')
      return emit('ask', `tool-gate flagged this call for approval: ${detail}`);
    return emit('allow', `tool-gate: ${detail}`);
  } catch (err) {
    // The event parsed but the gate threw. For a system-touching tool, fail CLOSED to a human
    // prompt; for anything else, fail open so a gate bug can't freeze the agent.
    const tool = String(event?.tool_name || '');
    return SYSTEM_TOUCHING.test(tool)
      ? emit('ask', `tool-gate errored on a ${tool} call — approve manually (${err.message})`)
      : emit('allow', `tool-gate skipped (hook error: ${err.message})`);
  }
});
