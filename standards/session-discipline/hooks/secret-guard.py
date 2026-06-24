#!/usr/bin/env python3
"""
secret-guard.py — PreToolUse hook (Bash matcher)

Blocks Bash commands that would print a secret to stdout — specifically
`op item get --reveal` and `op read op://` (1Password) called bare (not
captured into a shell variable via `=$(...)` subshell syntax). Extend
SECRET_PATTERNS with your own secrets-manager CLI to cover it too.

Event:   PreToolUse
Matcher: Bash
Exit 0:  allow
Exit 2:  block (stdout becomes the user-visible reason)

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


def is_bare_secret(command: str) -> tuple[bool, str]:
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


data = json.load(sys.stdin)
if data.get("tool_name") != "Bash":
    sys.exit(0)

command = data.get("tool_input", {}).get("command", "")
blocked, label = is_bare_secret(command)

if blocked:
    print(
        f"BLOCKED — '{label}' would print a secret to stdout (visible in conversation).\n\n"
        f"Capture into a variable instead:\n"
        f"  PASS=$(op item get <id> --fields password --reveal 2>/dev/null)\n"
        f"  curl ... --user \"user:$PASS\" ...\n\n"
        f"Never let --reveal or 'op read' appear bare in a Bash tool call.",
        flush=True,
    )
    sys.exit(2)

sys.exit(0)
