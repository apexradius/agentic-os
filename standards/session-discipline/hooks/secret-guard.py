#!/usr/bin/env python3
"""
secret-guard.py — PreToolUse hook (Bash matcher)

Blocks Bash commands that would print a secret to stdout — specifically
`op item get --reveal` and `op read op://` (1Password) called at command
position (not captured into a shell variable via `NAME=$(...)` subshell
syntax). Quoted prose is ignored by the command-position scanner; unbalanced
quotes fall back to the legacy conservative raw-text scan. Extend
SECRET_PATTERNS with your own secrets-manager CLI to cover it too.

Event:   PreToolUse
Matcher: Bash
Exit 0:  allow
Exit 2:  block (the reason must go to STDERR — on exit 2 the harness surfaces
         stderr to the agent; stdout is discarded)

Usage: add to settings.json under hooks.PreToolUse:
  {
    "matcher": "Bash",
    "hooks": [{ "type": "command", "command": "python3 /path/to/secret-guard.py", "timeout": 5 }]
  }
"""
import json, re, sys


SECRET_PATTERNS = [
    (r"op\s+item\s+get\b.*?--reveal", "op item get --reveal"),
    (r"op\s+read\s+op://", "op read op://"),
    # Add your org's secrets-CLI read commands here, e.g.:
    #   (r"<tool>\s+(?:get|show|read)\s+\S+", "<tool> get/show/read"),
]

SAFE_CAPTURE = re.compile(r"=\s*\$\(")
ENV_ASSIGN = re.compile(r"[A-Za-z_][A-Za-z0-9_]*=\S*")
WRAPPER_WORDS = {"sudo", "env", "nohup", "exec", "command", "time", "xargs"}


def legacy_is_bare_secret(command: str) -> tuple[bool, str]:
    for line in command.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        for pattern, label in SECRET_PATTERNS:
            if re.search(pattern, line):
                # Safe only when captured: VAR=$(op ...) or starts with $(
                if SAFE_CAPTURE.search(line) or line.startswith("$("):
                    continue
                return True, label
    return False, ""


def starts_segment(command: str, index: int, token: str) -> bool:
    return command.startswith(token, index)


def capture_before_subshell(text: str) -> bool:
    text = text.rstrip()
    return text.endswith("=") or text.endswith('="')


def normalize_segment(segment: str) -> str:
    segment = segment.lstrip().lstrip("\"'")
    while segment:
        env_match = ENV_ASSIGN.match(segment)
        if env_match:
            segment = segment[env_match.end():].lstrip()
            segment = segment.lstrip("\"'")
            continue

        word_match = re.match(r"[A-Za-z_][A-Za-z0-9_-]*\b", segment)
        if word_match and word_match.group(0) in WRAPPER_WORDS:
            segment = segment[word_match.end():].lstrip()
            segment = segment.lstrip("\"'")
            continue

        break
    return segment


def scan_segments(command: str):
    segments = []
    stack = [{"buf": [], "captured": False}]
    quote = None
    i = 0

    def finish_current():
        text = "".join(stack[-1]["buf"])
        if text.strip():
            segments.append((text, stack[-1]["captured"]))
        stack[-1]["buf"] = []

    while i < len(command):
        ch = command[i]

        if quote:
            if quote == '"' and starts_segment(command, i, "$("):
                captured = capture_before_subshell("".join(stack[-1]["buf"]))
                stack.append({"buf": [], "captured": captured, "quote": quote})
                quote = None
                i += 2
                continue
            if quote == '"' and ch == "`":
                return None
            stack[-1]["buf"].append(ch)
            if ch == quote:
                quote = None
            i += 1
            continue

        if ch in ("'", '"'):
            quote = ch
            stack[-1]["buf"].append(ch)
            i += 1
            continue

        if starts_segment(command, i, "$("):
            captured = capture_before_subshell("".join(stack[-1]["buf"]))
            stack.append({"buf": [], "captured": captured, "quote": quote})
            i += 2
            continue

        if ch == ")" and len(stack) > 1:
            finish_current()
            frame = stack.pop()
            quote = frame.get("quote")
            i += 1
            continue

        if starts_segment(command, i, "&&") or starts_segment(command, i, "||"):
            finish_current()
            stack[-1]["captured"] = False
            i += 2
            continue

        if ch in (";", "|", "`", "\n"):
            finish_current()
            stack[-1]["captured"] = False
            i += 1
            continue

        stack[-1]["buf"].append(ch)
        i += 1

    if quote:
        return None

    while len(stack) > 1:
        finish_current()
        stack.pop()

    finish_current()
    return segments


def is_bare_secret(command: str) -> tuple[bool, str]:
    segments = scan_segments(command)
    if segments is None:
        return legacy_is_bare_secret(command)

    for segment, captured in segments:
        segment = normalize_segment(segment)
        if not segment or segment.startswith("#"):
            continue
        for pattern, label in SECRET_PATTERNS:
            if re.match(pattern, segment):
                if captured:
                    continue
                return True, label
    return False, ""


def main() -> int:
    data = json.load(sys.stdin)
    if data.get("tool_name") != "Bash":
        return 0

    command = data.get("tool_input", {}).get("command", "")
    blocked, label = is_bare_secret(command)

    if blocked:
        print(
            f"BLOCKED — '{label}' would print a secret to stdout (visible in conversation).\n\n"
            f"Capture into a variable instead:\n"
            f"  PASS=$(op item get <id> --fields password --reveal 2>/dev/null)\n"
            f"  curl ... --user \"user:$PASS\" ...\n\n"
            f"Never let --reveal or 'op read' appear bare in a Bash tool call.",
            file=sys.stderr,
            flush=True,
        )
        return 2

    return 0


try:
    sys.exit(main())
except Exception as exc:
    print(f"secret-guard notice: internal error, allowing command ({exc})", file=sys.stderr)
    sys.exit(0)
