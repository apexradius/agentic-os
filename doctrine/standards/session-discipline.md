# Session Discipline Standard

The structural enforcement of the PIV loop's planning phase for any agent runtime that
runs inside a conversational shell. This is the **standard**; the hooks and
`session-discipline` gate that *enforce* it are in
[`framework/standards/session-discipline/`](../../standards/session-discipline/).

See [`framework/loop/planning.md`](../../loop/planning.md) for the full PIV doctrine this
standard makes structural.

## Why hooks, not reminders

Rules written as prose are advisory — an agent operating under context pressure skips
them. Hooks written as `PreToolUse` gates are structural: the runtime rejects the tool
call. This standard lifts the planning phase from "remember to do this" to "cannot
proceed without doing this."

## The gate

Before any file edit (`Edit` or `Write` tool call), the active session's `SESSION.md`
must contain a planning block with:

- **ASSUMPTIONS** — at least 3 specific claims about the internal logic of the current
  task (not generic environment assumptions — those are not specific and will not satisfy
  the gate).
- **UNKNOWNS** — at least 1 thing not yet verified or checked.
- **VERIFICATION_PLAN** — at least 1 concrete step that proves the change is correct.

If any section is missing, the gate exits `2` and the runtime blocks the tool call with
a `422 PLANNING REQUIRED` message.

## Discovery mode

A complementary `read-only-gate` recognizes a `.discovery-mode` flag file. When
discovery mode is active, all write operations are blocked except writes to the sessions
directory (so planning blocks can still be authored). This prevents accidental edits
during the exploration phase and makes the explore-then-plan-then-edit workflow
enforced, not aspirational.

## Session lifecycle

A `SessionStart` hook creates `SESSION.md` under `~/.claude/sessions/` and injects an
enforcement notice into the model's context. A `Stop` hook archives completed sessions
and cleans up discovery-mode flags. Session state is plain Markdown — no database, no
daemon, no network.

## Instance configuration

Instances copy the hooks from this standard's `hooks/` directory to `~/.claude/hooks/`
and wire them in `settings.json` using `examples/settings.json` as a template.
Instance-specific rule names, project paths, or downstream hooks belong in the instance
configuration, not here.

> Last reviewed: 2026-06-22
