#!/usr/bin/env python3
"""
context-budget-guard.py — Living-Handoff Context Guard

One hook, five roles (branches on hook_event_name):

  PreToolUse       The freshness ladder. When context crosses a rung whose handoff
                   has not yet been written/refreshed, momentarily DENY non-handoff
                   tools (read-only tools + the handoff write itself stay allowed),
                   with a reason telling the model to refresh the handoff. The instant
                   the handoff is refreshed the gate releases — work flows until the
                   next rung. It NEVER hard-stops and it never forces compaction.

  PostToolUse      When a Write/Edit lands on the session HANDOFF file, record the
                   rung the current context satisfies (marks the handoff "current").
                   When a tool result is oversized, write it to a session-scoped
                   file and emit only a compact preview + pointer into context.

  UserPromptSubmit Inject a one-line budget advisory (context %, handoff status, path).
                   Awareness only — never blocks.

  PreCompact       Feed the current HANDOFF contents into the (free, built-in)
                   auto-compaction as additionalContext, so post-compaction recovery
                   reads a well-maintained record instead of reconstructing from
                   scratch — and the summary itself is seeded by structured state.

Design contract:
  * Reads JSON from stdin.
  * FAILS OPEN — any error => exit 0 with no decision. A guardrail must never brick
    a session or block on its own bug.
  * No live token data exists in hook input, so the budget is derived from the
    transcript's most recent assistant `message.usage`
    (input + cache_read + cache_creation), the same number the statusline shows.

No API key, no /compact forcing, no autonomous mode. The harness's built-in
auto-compact does the compaction; this hook only keeps the handoff fresh.

Env overrides:
  CTXGUARD_WINDOW   total window in tokens          (default 1000000)
  CTXGUARD_CREATE   first-handoff rung, percent     (default 45)
  CTXGUARD_LADDER   refresh rungs, csv percent       (default "55,65,75,85,95")
  CTXGUARD_DROP     pct drop that signals a compaction reset (default 10)
  CTXGUARD_OFFLOAD_CHARS          result offload threshold chars (default 50000)
  CTXGUARD_OFFLOAD_PREVIEW_CHARS  result preview chars          (default 2000)
  CTXGUARD_OFFLOAD_DIR            explicit result output dir    (default session-local)
"""

import json
import hashlib
import os
import re
import sys
import time

# ---- config -----------------------------------------------------------------


def _int_env(name, default):
    try:
        return int(float(os.environ.get(name, "")))
    except (ValueError, TypeError):
        return default


WINDOW = _int_env("CTXGUARD_WINDOW", 1_000_000)
CREATE_RUNG = _int_env("CTXGUARD_CREATE", 45)
DROP = _int_env("CTXGUARD_DROP", 10)
OFFLOAD_CHARS = _int_env("CTXGUARD_OFFLOAD_CHARS", 50_000)
OFFLOAD_PREVIEW_CHARS = _int_env("CTXGUARD_OFFLOAD_PREVIEW_CHARS", 2_000)
OFFLOAD_DIR = os.environ.get("CTXGUARD_OFFLOAD_DIR", "")


def _ladder():
    raw = os.environ.get("CTXGUARD_LADDER", "55,65,75,85,95")
    rungs = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            rungs.append(int(float(part)))
        except (ValueError, TypeError):
            continue
    allr = sorted(set([CREATE_RUNG] + rungs))
    return allr or [45, 55, 65, 75, 85, 95]


ALL_RUNGS = _ladder()

# Tools that are always allowed even while the gate is "refresh-due": reading state
# to write a faithful handoff, the handoff write itself, and lightweight planning.
ALWAYS_ALLOW_TOOLS = {"Read", "Grep", "Glob", "TodoWrite", "Skill", "LS"}
HANDOFF_WRITE_TOOLS = {"Write", "Edit", "MultiEdit", "NotebookEdit"}

# Read-only Bash allowlist (whole-command must match and contain no chaining).
_READONLY_BASH = re.compile(
    r"^\s*(git\s+(status|diff|log|show|branch|rev-parse|remote|config\s+--get)\b"
    r"|ls\b|pwd\b|cat\b|head\b|tail\b|wc\b|stat\b|date\b|hostname\b"
    r"|which\b|command\s+-v\b|echo\b)"
)
_BASH_META = re.compile(r"[;&|`]|\$\(|\bsudo\b|>>?|<")


# ---- helpers ----------------------------------------------------------------


def _home():
    return os.path.expanduser("~")


def _session_dir(session_id):
    return os.path.join(_home(), ".claude", "session-env", str(session_id))


def _handoff_path(session_id):
    return os.path.join(_session_dir(session_id), "HANDOFF.md")


def _sidecar_path(session_id):
    return os.path.join(_session_dir(session_id), "context-guard.json")


def _tool_results_dir(session_id):
    if OFFLOAD_DIR:
        return os.path.expanduser(OFFLOAD_DIR)
    return os.path.join(_session_dir(session_id), "tool-results")


def rung_for(pct):
    """Highest ladder rung at or below pct; 0 if below the first rung."""
    satisfied = 0
    for r in ALL_RUNGS:
        if pct >= r:
            satisfied = r
    return satisfied


def context_pct(transcript_path):
    """Most recent assistant message.usage -> effective context as % of WINDOW.
    Returns None if it cannot be determined (caller then fails open)."""
    if not transcript_path or not os.path.isfile(transcript_path):
        return None
    try:
        size = os.path.getsize(transcript_path)
        with open(transcript_path, "rb") as fh:
            # Tail the last ~4MB — plenty to contain the latest assistant turn,
            # bounded so the gate stays fast on multi-MB transcripts.
            tail = 4 * 1024 * 1024
            if size > tail:
                fh.seek(size - tail)
                fh.readline()  # drop the partial first line
            data = fh.read()
    except OSError:
        return None
    lines = data.split(b"\n")
    for raw in reversed(lines):
        raw = raw.strip()
        if not raw or b"usage" not in raw:
            continue
        try:
            obj = json.loads(raw)
        except (ValueError, TypeError):
            continue
        msg = obj.get("message")
        usage = msg.get("usage") if isinstance(msg, dict) else obj.get("usage")
        if not isinstance(usage, dict):
            continue
        try:
            ctx = (
                int(usage.get("input_tokens", 0) or 0)
                + int(usage.get("cache_read_input_tokens", 0) or 0)
                + int(usage.get("cache_creation_input_tokens", 0) or 0)
            )
        except (ValueError, TypeError):
            continue
        if ctx <= 0:
            continue
        return ctx / float(WINDOW) * 100.0
    return None


def load_sidecar(session_id):
    try:
        with open(_sidecar_path(session_id)) as fh:
            obj = json.load(fh)
        return {
            "last_handoff_rung": int(obj.get("last_handoff_rung", 0) or 0),
            "last_seen_pct": float(obj.get("last_seen_pct", 0) or 0),
        }
    except (OSError, ValueError, TypeError):
        return {"last_handoff_rung": 0, "last_seen_pct": 0.0}


def save_sidecar(session_id, state):
    try:
        os.makedirs(_session_dir(session_id), exist_ok=True)
        tmp = _sidecar_path(session_id) + ".tmp"
        with open(tmp, "w") as fh:
            json.dump(state, fh)
        os.replace(tmp, _sidecar_path(session_id))
    except OSError:
        pass  # fail open — sidecar is best-effort


def emit(obj):
    sys.stdout.write(json.dumps(obj))


def _safe_name(value):
    name = re.sub(r"[^A-Za-z0-9._-]+", "-", str(value or "tool")).strip("-")
    return name[:48] or "tool"


def _stringify(value):
    if isinstance(value, str):
        return value
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2)
    if value is None:
        return ""
    return str(value)


def _result_candidates(data):
    keys = [
        "tool_response",
        "tool_result",
        "tool_output",
        "result",
        "output",
        "content",
        "stdout",
        "stderr",
    ]
    out = []
    for key in keys:
        if key in data:
            text = _stringify(data.get(key))
            if text:
                out.append((key, text))
    return out


def offload_large_result(data, session_id):
    if OFFLOAD_CHARS <= 0 or not session_id:
        return ""
    candidates = _result_candidates(data)
    if not candidates:
        return ""
    source_key, payload = max(candidates, key=lambda item: len(item[1]))
    if len(payload) <= OFFLOAD_CHARS:
        return ""
    try:
        directory = _tool_results_dir(session_id)
        os.makedirs(directory, exist_ok=True)
        digest = hashlib.sha256(payload.encode("utf-8", errors="replace")).hexdigest()[:12]
        stamp = int(time.time() * 1000)
        tool = _safe_name(data.get("tool_name", "tool"))
        path = os.path.join(directory, f"{tool}-{stamp}-{digest}.txt")
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(payload)
    except OSError:
        return ""

    preview = payload[:max(0, OFFLOAD_PREVIEW_CHARS)]
    if len(payload) > len(preview):
        preview += "\n...[tool result offloaded; preview truncated]..."
    return (
        "[context-budget] Large PostToolUse result offloaded to {path} "
        "({chars} chars from {source}). Preview:\n\n{preview}"
    ).format(path=path, chars=len(payload), source=source_key, preview=preview)


def is_handoff_write(tool_name, tool_input, handoff_path):
    if tool_name not in HANDOFF_WRITE_TOOLS:
        return False
    fp = (tool_input or {}).get("file_path") or (tool_input or {}).get("notebook_path")
    if not fp:
        return False
    try:
        return os.path.realpath(os.path.expanduser(fp)) == os.path.realpath(handoff_path)
    except OSError:
        return os.path.abspath(os.path.expanduser(fp)) == os.path.abspath(handoff_path)


def tool_is_exempt(tool_name, tool_input, handoff_path):
    if tool_name in ALWAYS_ALLOW_TOOLS:
        return True
    if is_handoff_write(tool_name, tool_input, handoff_path):
        return True
    if tool_name == "Bash":
        cmd = (tool_input or {}).get("command", "") or ""
        if _READONLY_BASH.match(cmd) and not _BASH_META.search(cmd):
            return True
    return False


# ---- event handlers ---------------------------------------------------------


def handle_pretooluse(data):
    session_id = data.get("session_id")
    if not session_id:
        return 0
    pct = context_pct(data.get("transcript_path"))
    if pct is None:
        return 0  # unknown budget => no gating

    state = load_sidecar(session_id)
    # Compaction detector: a meaningful pct drop means the window was compacted —
    # reset the ladder so the handoff is re-established for the new climb.
    if pct < state["last_seen_pct"] - DROP:
        state["last_handoff_rung"] = 0
    if pct < CREATE_RUNG:
        state["last_handoff_rung"] = 0

    changed = False
    if round(pct) != round(state["last_seen_pct"]):
        state["last_seen_pct"] = pct
        changed = True

    required = rung_for(pct)
    handoff_path = _handoff_path(session_id)
    handoff_current = (
        state["last_handoff_rung"] >= required and os.path.isfile(handoff_path)
    )

    if changed:
        save_sidecar(session_id, state)

    if required == 0 or handoff_current:
        return 0  # all clear

    # Refresh due. Exempt tools (handoff write, reads, Skill) pass; rest deny.
    tool_name = data.get("tool_name", "")
    tool_input = data.get("tool_input", {})
    if tool_is_exempt(tool_name, tool_input, handoff_path):
        return 0

    reason = (
        "Context budget at {pct:.0f}% — the handoff for the {rung}% rung is not yet "
        "written/refreshed. Update it BEFORE more work: run /handoff (or write "
        "{path}). It is the living record auto-compact will recover from, so keep it "
        "current as context climbs. Read-only tools and the handoff write are still "
        "allowed; this releases the instant the handoff is refreshed."
    ).format(pct=pct, rung=required, path=handoff_path)

    emit({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    })
    return 0


def handle_posttooluse(data):
    session_id = data.get("session_id")
    if not session_id:
        return 0
    handoff_path = _handoff_path(session_id)
    if is_handoff_write(data.get("tool_name", ""), data.get("tool_input", {}), handoff_path):
        pct = context_pct(data.get("transcript_path"))
        state = load_sidecar(session_id)
        required = rung_for(pct) if pct is not None else 0
        # A fresh handoff satisfies every rung at or below the current context. If written
        # proactively below the first rung, still credit the first rung.
        state["last_handoff_rung"] = max(state["last_handoff_rung"], required or CREATE_RUNG)
        if pct is not None:
            state["last_seen_pct"] = pct
        save_sidecar(session_id, state)

    offload = offload_large_result(data, session_id)
    if offload:
        emit({
            "hookSpecificOutput": {
                "hookEventName": "PostToolUse",
                "additionalContext": offload,
            }
        })
    return 0


def handle_userpromptsubmit(data):
    session_id = data.get("session_id")
    if not session_id:
        return 0
    pct = context_pct(data.get("transcript_path"))
    if pct is None or pct < (CREATE_RUNG - 5):
        return 0  # stay quiet at low context

    state = load_sidecar(session_id)
    required = rung_for(pct)
    handoff_path = _handoff_path(session_id)
    handoff_current = (
        required == 0
        or (state["last_handoff_rung"] >= required and os.path.isfile(handoff_path))
    )
    status = "current" if handoff_current else "REFRESH-DUE@{}%".format(required)
    line = (
        "[context-budget] {pct:.0f}% of window used · handoff: {status} · "
        "path: {path} · refresh with /handoff to keep the auto-compact record current."
    ).format(pct=pct, status=status, path=handoff_path)

    emit({
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": line,
        }
    })
    return 0


def handle_precompact(data):
    session_id = data.get("session_id")
    if not session_id:
        return 0
    handoff_path = _handoff_path(session_id)
    if not os.path.isfile(handoff_path):
        return 0
    try:
        with open(handoff_path) as fh:
            content = fh.read()
    except OSError:
        return 0
    if not content.strip():
        return 0
    if len(content) > 12000:
        content = content[:12000] + "\n...[handoff truncated for compaction]..."
    injected = (
        "A living session HANDOFF was maintained during this session. Preserve its "
        "facts through compaction and resume from it — do not reconstruct state from "
        "scratch. HANDOFF contents follow:\n\n" + content
    )
    emit({
        "hookSpecificOutput": {
            "hookEventName": "PreCompact",
            "additionalContext": injected,
        }
    })
    return 0


HANDLERS = {
    "PreToolUse": handle_pretooluse,
    "PostToolUse": handle_posttooluse,
    "UserPromptSubmit": handle_userpromptsubmit,
    "PreCompact": handle_precompact,
}


def main():
    try:
        data = json.loads(sys.stdin.read() or "{}")
    except (ValueError, TypeError):
        return 0
    if not isinstance(data, dict):
        return 0
    event = data.get("hook_event_name") or data.get("hookEventName") or ""
    handler = HANDLERS.get(event)
    if handler is None:
        return 0
    try:
        return handler(data)
    except Exception:
        return 0  # fail open on any handler error


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        sys.exit(0)
