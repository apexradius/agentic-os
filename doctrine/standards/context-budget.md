# Context Budget Standard

The structural enforcement of the framework's living-handoff requirement. As a session's
context window fills, the agent must keep a continuously-updated handoff file fresh — not
as a courtesy, but because the host runtime's auto-compaction recovers from it. This is
the **standard**; the hook that *enforces* it is in
[`framework/standards/context-budget/`](../../standards/context-budget/).

See [`framework/loop/context.md`](../../loop/context.md) for the context-management
doctrine this standard makes structural.

## Why a living handoff, not a one-time checkpoint

A checkpoint is a deliberate snapshot at a milestone. A handoff is a continuously
refreshed record that never goes stale. The distinction matters when context fills
unexpectedly: a checkpoint may be an hour old; the handoff is at most one rung behind.

Auto-compaction summarizes the session window. A summary seeded with structured state
(goal, plan, accomplished, VNA) is far more recoverable than one reconstructed from raw
conversation. The living handoff is the seed.

## The ladder

A single percentage-based ladder drives the enforcement:

- **Create** (default 45%): the handoff must exist by this point.
- **Refresh rungs** (default 55, 65, 75, 85, 95%): the handoff must be rewritten at
  each rung as context climbs.

The numbers are defaults, not law. Instances configure them via environment variables
(`CTXGUARD_CREATE`, `CTXGUARD_LADDER`). The rationale for the defaults: 45% gives
enough runway to write a substantive handoff before pressure builds; 10-percentage-point
intervals keep it fresh without imposing overhead on short sessions.

## Lean on the host auto-compaction; never force it

This standard deliberately does not invoke any compaction API and does not call
`/compact`. The host runtime compacts on its own schedule. The standard's only job is
to ensure the handoff is ready when compaction fires. Forcing compaction to meet a
schedule is a control inversion — it trades the agent's judgment for a timer.

## Never hard-block; gate at the tool call level

The gate denies a single tool call and releases on the next one once the handoff is
refreshed. There is no session freeze, no lock, and no escalation path. Read-only tools
(Read, Grep, Glob, LS, read-only git, Skill) are always allowed so the agent can gather
the state needed to write a faithful handoff.

A guardrail that bricks a session on its own bug is worse than no guardrail. The hook
fails open on every error: any exception, missing file, or malformed input results in
exit 0 with no decision.

## The compaction seed

The `PreCompact` event branch reads the HANDOFF file and injects its contents into the
compaction's `additionalContext`. The compaction summary therefore carries:

- the session goal
- the plan
- the accumulated accomplished list
- what was in-flight
- the VNA

Recovery after compaction reads a structured record, not a reconstructed guess. Note the
honest limitation: the `PreCompact` `additionalContext` injection path degrades
gracefully if the handoff file does not exist — the compaction proceeds normally, and the
handoff file persists on disk regardless.

## Oversized tool-result offload

Tool results can consume the same scarce context as conversation. A runtime hook that sees
an oversized `PostToolUse` result should write the full result to a session-local file and
emit only a compact pointer plus preview into context. The default threshold is 50,000
characters and the default preview is 2,000 characters; instances may tune both.

The offload path is a context-preservation mechanism, not a security boundary. It must fail
open: if the output directory cannot be created or the write fails, the original tool flow
continues. A host may still inject the full original result; the portable requirement is that
the framework provides a bounded pointer artifact the agent can cite, re-open, or carry
through compaction.

## Instance configuration

Instances copy the hook from this standard's `hooks/` directory to `~/.claude/hooks/`
and wire it in `settings.json` using `examples/settings.json` as a template. The four
event registrations (PreToolUse, PostToolUse, UserPromptSubmit, PreCompact) all invoke
the same script — the script branches on `hook_event_name`. Instance-specific window
sizes, ladder percentages, offload thresholds, or downstream hooks belong in the instance
configuration, not here.

> Last reviewed: 2026-06-25
