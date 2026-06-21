"""Direct Gemini API call for the chitchat fast-path.

Bypasses the gemini CLI entirely. No GEMINI.md, no hooks, no memory-pull,
no agent loading — pure model output. Uses gemini-2.5-flash-lite for speed
(free tier is generous; chitchat shouldn't ever hit a quota wall).

Falls back to gemini CLI if GEMINI_API_KEY is unset.
"""
from __future__ import annotations

import os
import sys

MODEL = os.environ.get("APEX_CHITCHAT_MODEL", "gemini-2.5-flash-lite")


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: gemini_client.py <prompt>", file=sys.stderr)
        return 2

    prompt = " ".join(sys.argv[1:])
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")

    if not api_key:
        # No key → exec the gemini CLI (subject to user's config drift).
        os.execvp("gemini", ["gemini", "-p", prompt])
        return 0  # unreachable

    try:
        from google import genai
    except ImportError:
        print("google-genai not installed in router venv", file=sys.stderr)
        return 1

    client = genai.Client(api_key=api_key)
    resp = client.models.generate_content(
        model=MODEL,
        contents=prompt,
    )
    text = (resp.text or "").rstrip()
    if text:
        print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
