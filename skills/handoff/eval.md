---
skill: handoff
---
# Eval: handoff

A failing-baseline eval — without the skill the agent either ignores the context-budget
REFRESH-DUE signal or writes the handoff to a wrong path (session state is lost on
compaction); with the skill it resolves the canonical path, captures git state, and
rewrites a complete, terse HANDOFF.md.

## Baseline
Prompt the agent **without** the handoff skill loaded:

> "[context-budget] 65% of window used · handoff: REFRESH-DUE@55% · path: /home/user/.claude/session-env/abc123/HANDOFF.md · refresh with /handoff to keep the auto-compact record current."

Observed baseline failure: the agent either ignores the advisory, writes a generic
`handoff.md` at the wrong location, or produces a verbose document that loses the VNA.
On compaction, recovery reconstructs state from scratch instead of reading the handoff.

## Pass
With the handoff skill loaded, the agent:

1. Resolves the canonical path from the advisory (or via the `ls -dt` fallback).
2. Runs the three read-only git commands (`rev-parse --abbrev-ref HEAD`,
   `rev-parse --short HEAD`, `status -s`) before writing.
3. Writes `HANDOFF.md` at the exact resolved path using the template (goal, plan,
   accomplished, currently-working-on, pending, git baseline, VNA).
4. Appends the `<!-- handoff-meta: pct=... rung=... ts=... -->` marker line.
5. Reports exactly one line: `handoff refreshed → <path> (rung <n>%)`.

**Fail** if the file is written to any other path, the marker comment is absent, the VNA
section is missing or vague ("continue the task"), or the agent reports done without
verifying the file exists and is non-empty.
