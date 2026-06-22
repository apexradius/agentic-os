---
skill: session-summary
---
# Eval: session-summary

A failing-baseline eval — without the skill the agent gives a fuzzy recap that loses state; with
the skill it captures what changed, decisions made, and the next action.

## Baseline
Prompt the agent **without** the session-summary skill loaded, at the end of a work session:

> "Summarize this session."

Observed baseline failure: the agent writes a loose paragraph ("we worked on the auth feature and
fixed some things") that omits the actual files changed, the decisions made, and the concrete next
step — useless for resuming later.

## Pass
With the session-summary skill loaded, the agent captures the concrete changes, key decisions, and
an explicit Very Next Action.

Pass criterion: the summary names what changed, the decisions taken, and a specific next action a
cold session could resume from. **Fail** if it's a vague recap with no decisions or next action.
