#!/usr/bin/env python3
"""completion-audit.py — Stop hook.

The executable half of the verification standard's "definition of done"
(framework/loop/verification.md): an agent may not end a turn on an unverified
"done". This hook reads the session transcript and, when the final message reads
as a completion claim BUT the turn changed source without ever triggering it,
holds the stop so the agent must either observe the changed path or name what it
could not verify (VNA).

Event:   Stop
Matcher: (none — fires on every session stop)

Deterministic proxy for the standard, and honest about its limits:

  - "changed source"  = an Edit/Write/MultiEdit/NotebookEdit to a NON-doc file
                        (docs-only turns have no runtime surface to observe).
  - "triggered it"    = a Bash tool call appears AFTER the last such change.
  - "completion claim"= the final assistant text matches a done/shipped pattern.
  - "named the gap"   = the final assistant text states a VNA / unverified caveat.

It blocks only when: claim AND source-changed AND NOT triggered AND NOT gap-named.
It CANNOT judge whether the Bash call really exercised the change, or whether a
stated caveat is honest — that judgment stays with review. This gate catches the
one thing a gate can catch: a "done" with no command run behind it.

Safety spine (all non-negotiable for a Stop gate):
  - FAIL OPEN. Any parse/read/IO error -> exit 0. A Stop gate that fails closed
    would make sessions un-endable.
  - LOOP GUARD. Honor `stop_hook_active`: never block a stop that a previous
    block already caused. Blocks at most once per stop cycle.
  - BYPASS. `~/.claude/.ownership-audit-bypass` or `/tmp/claude-ownership-bypass`
    -> exit 0, always.
  - ADVISORY BY DEFAULT. Records one line to `~/.claude/ownership-audit.log` and
    allows the stop. Only hard-blocks when `OWNERSHIP_AUDIT_ENFORCE=1` or
    `~/.claude/.ownership-audit-enforce` exists (the calibrate-then-enforce path).
"""

import json
import os
import re
import sys

DOC_EXT = {".md", ".markdown", ".mdx", ".txt", ".rst"}
CHANGE_TOOLS = {"Edit", "Write", "MultiEdit", "NotebookEdit"}
EXEC_TOOLS = {"Bash"}

CLAIM_RE = re.compile(
    r"\b(done|shipped|complete[d]?|finished|fixed|"
    r"works now|it works|working now|"
    r"all (green|passing)|tests? (pass|passing|are green)|"
    r"ready to (merge|ship)|good to go)\b|✅",
    re.IGNORECASE,
)

# An explicit acknowledgment that something was NOT verified satisfies the
# standard's "remaining gaps are named / VNA is clear" clause -> do not block.
GAP_RE = re.compile(
    r"\b(VNA|not (yet )?verified|unverified|could ?n.?t verify|"
    r"have ?n.?t (tested|verified|run)|did ?n.?t (run|test|verify)|"
    r"not tested|untested|needs verification|remaining gap|"
    r"gaps?:|caveat|follow.?up)\b",
    re.IGNORECASE,
)

REASON = (
    "Completion audit (ownership standard): this turn changed source and reads "
    "as complete, but no command ran after the last change — the changed "
    "path was not triggered and its output was not observed. Before ending: "
    "(1) trigger the changed path with real input, (2) observe the output, "
    "(3) confirm it matches intent. If you genuinely cannot verify this turn, "
    "say so plainly — name what is unverified and why (VNA) — that "
    "satisfies the standard. Do not end on an unverified \"done\"."
)


def allow():
    sys.exit(0)


def enforce_mode(home):
    if os.environ.get("OWNERSHIP_AUDIT_ENFORCE") == "1":
        return True
    return os.path.exists(os.path.join(home, ".claude", ".ownership-audit-enforce"))


def block():
    # Stop-hook control channel: `decision: block` holds the stop and feeds
    # `reason` back to the model. Exit 0 — the JSON, not the code, decides.
    print(json.dumps({"decision": "block", "reason": REASON}))
    sys.exit(0)


def log_advisory(home):
    try:
        log_dir = os.path.join(home, ".claude")
        os.makedirs(log_dir, exist_ok=True)
        with open(os.path.join(log_dir, "ownership-audit.log"), "a") as fh:
            fh.write("completion-audit: advisory finding "
                     "(unverified completion claim; source changed, no post-change run)\n")
    except Exception:
        pass  # advisory logging must never break the stop


def iter_blocks(events):
    """Yield (kind, payload) content blocks in transcript order.

    kind is 'tool' -> payload is (name, input_dict); 'text' -> payload is str.
    Robust to shape variation: skips anything it does not recognize.
    """
    for ev in events:
        if not isinstance(ev, dict):
            continue
        msg = ev.get("message")
        if not isinstance(msg, dict):
            continue
        if msg.get("role") != "assistant":
            continue
        content = msg.get("content")
        if isinstance(content, str):
            yield ("text", content)
            continue
        if not isinstance(content, list):
            continue
        for blk in content:
            if not isinstance(blk, dict):
                continue
            btype = blk.get("type")
            if btype == "tool_use":
                yield ("tool", (blk.get("name", ""), blk.get("input") or {}))
            elif btype == "text":
                yield ("text", blk.get("text", ""))


def changed_file_path(tool_input):
    if not isinstance(tool_input, dict):
        return None
    return tool_input.get("file_path") or tool_input.get("notebook_path")


def main():
    try:
        payload = json.loads(sys.stdin.read())
    except Exception:
        allow()  # fail open

    if not isinstance(payload, dict):
        allow()

    # Loop guard — never block a stop caused by a prior block.
    if payload.get("stop_hook_active"):
        allow()

    home = os.path.expanduser("~")

    # Bypass hatch.
    for p in (os.path.join(home, ".claude", ".ownership-audit-bypass"),
              "/tmp/claude-ownership-bypass"):
        if os.path.exists(p):
            allow()

    transcript_path = payload.get("transcript_path")
    if not transcript_path or not os.path.exists(transcript_path):
        allow()  # nothing to audit

    try:
        events = []
        with open(transcript_path) as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    events.append(json.loads(line))
                except Exception:
                    continue  # tolerate a malformed line
    except Exception:
        allow()

    idx = 0
    last_source_change = -1   # index of last change to a non-doc file
    last_exec = -1            # index of last Bash execution
    last_text = ""            # final assistant text seen

    for kind, payload_blk in iter_blocks(events):
        idx += 1
        if kind == "tool":
            name, tool_input = payload_blk
            if name in CHANGE_TOOLS:
                path = changed_file_path(tool_input)
                ext = os.path.splitext(path)[1].lower() if path else ""
                if ext not in DOC_EXT:  # unknown ext counts as source (fail toward auditing)
                    last_source_change = idx
            elif name in EXEC_TOOLS:
                last_exec = idx
        elif kind == "text" and payload_blk.strip():
            last_text = payload_blk

    source_changed = last_source_change >= 0
    post_change_exec = last_exec > last_source_change
    completion_claim = bool(CLAIM_RE.search(last_text))
    named_gap = bool(GAP_RE.search(last_text))

    should_hold = (
        completion_claim
        and source_changed
        and not post_change_exec
        and not named_gap
    )

    if not should_hold:
        allow()

    if enforce_mode(home):
        block()
    else:
        log_advisory(home)
        allow()


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:
        sys.exit(0)  # last-resort fail-open
