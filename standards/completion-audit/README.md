# completion-audit

The executable enforcement of the verification standard's *definition of done*
([`framework/loop/verification.md`](../../loop/verification.md)): **an agent may not
end a turn on an unverified "done".** A `Stop` hook reads the session transcript and,
when the final message reads as a completion claim but the turn changed source without
ever triggering it, holds the stop — forcing the agent to either observe the changed
path or name what it could not verify (VNA).

This turns "Code-shipped is not done. Verified-working is done." from advisory prose
into a runtime constraint — the mirror of what [`session-discipline`](../session-discipline/)
does for the *plan* half of the loop.

## Run it

```bash
# Selftest only (proves the hook is correct, uses an isolated tmp HOME):
node framework/standards/completion-audit/validate.mjs

# Full harness (runs this alongside every other primitive and standard):
node framework/primitives/_lib/validate.mjs --all
```

## What it enforces (1 hook)

| Hook | Event | Matcher | Behavior |
|---|---|---|---|
| `completion-audit.py` | `Stop` | (none) | Holds the stop when the final message claims completion, the turn changed non-doc source, no command ran after the last change, and no gap/VNA is named. Advisory (logs + allows) by default; hard-blocks under enforce mode. |

The deterministic proxy for the standard:

- **changed source** — an `Edit`/`Write`/`MultiEdit`/`NotebookEdit` to a **non-doc**
  file (a docs-only turn — `.md`/`.txt`/`.rst`/`.mdx` — has no runtime surface to observe).
- **triggered it** — a `Bash` tool call appears **after** the last such change.
- **completion claim** — the final assistant text matches a done/shipped/fixed pattern.
- **named the gap** — the final assistant text states a VNA / "not verified" caveat.

It blocks **only** when: claim **and** source-changed **and not** triggered **and not**
gap-named.

## Safety spine (why a Stop gate is different)

A gate on `Stop` fails in the opposite direction from a `PreToolUse` gate — a false
block makes a session **un-endable**, so every design choice bends toward *allow*:

- **Fail open.** Any parse/read/IO error → exit 0. python3 absent → the whole gate
  skips. A completion audit that fails closed would be worse than none.
- **Loop guard.** Honors `stop_hook_active`: it never blocks a stop that a previous
  block already caused, so it holds **at most once** per stop cycle.
- **Advisory by default.** Records one line to `~/.claude/ownership-audit.log` and
  allows the stop. It only hard-blocks under **enforce mode** — the
  calibrate-then-enforce path: run advisory long enough to read the log and tune the
  false-positive rate, then flip enforce on. A gate flipped straight to blocking on day
  one gets bypassed; a calibrated one gets trusted.
- **Bypass.** `~/.claude/.ownership-audit-bypass` (or `/tmp/claude-ownership-bypass`)
  → always allow.

**Enforce mode** is on when `OWNERSHIP_AUDIT_ENFORCE=1` **or**
`~/.claude/.ownership-audit-enforce` exists.

## What it deliberately does NOT do

Honesty is the point — the hook enforces the *shape* of done, not its substance:

- **No judgment of whether verification was real.** It sees that a `Bash` call ran
  after the change; it cannot know the command actually exercised the changed path.
  A determined agent can still satisfy the gate with a no-op run — that failure mode
  belongs to review, not a hook.
- **No judgment of whether a stated caveat is honest.** Naming any VNA/gap satisfies
  the "gaps are named" clause. The gate rewards *stating* the limit, which is the
  behavior the standard wants; it does not police the limit's accuracy.
- **Extension-based source detection.** "Is this code?" is decided by file extension.
  An unknown extension counts as source (fail toward auditing). A code change written
  to a `.txt` path would be missed — a known, accepted blind spot.
- **No cross-session state.** It reads only the current transcript.

## Install

Copy the hook to `~/.claude/hooks/` and merge `examples/settings.json` into your
`~/.claude/settings.json`. The hook is `python3`, stdlib only — no npm install.

```bash
cp framework/standards/completion-audit/hooks/completion-audit.py ~/.claude/hooks/
chmod +x ~/.claude/hooks/completion-audit.py
```

Merge the `Stop` wiring from `examples/settings.json`, keeping any existing `Stop`
hooks (it composes cleanly alongside `session-close.sh` / `mcp-cleanup.sh`). Start
in the default advisory mode; after calibrating against `~/.claude/ownership-audit.log`,
flip enforce mode on.

## Verify

```bash
node framework/standards/completion-audit/validate.mjs   # selftest, isolated tmp HOME
node framework/primitives/_lib/validate.mjs --all         # full harness
bash framework/runtime/verify-zone-purity.sh              # zero instance coupling
```

> Last reviewed: 2026-07-14
