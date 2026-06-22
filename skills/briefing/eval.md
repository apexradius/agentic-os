---
skill: briefing
---
# Eval: briefing

A failing-baseline eval — without the skill the agent writes a generic status blurb; with the
skill it assembles a briefing from real sources at the right scope.

## Baseline
Prompt the agent **without** the briefing skill loaded:

> "Give me a briefing."

Observed baseline failure: the agent produces a vague "things are progressing well" summary
invented from conversation, ignoring git history, CI status, calendar, email, and tasks. Nothing
is grounded; the scope (session vs daily vs weekly) is guessed.

## Pass
With the briefing skill loaded, the agent detects (or confirms) scope and pulls from the real
sources — git, CI, calendar, email, tasks — into a structured briefing.

Pass criterion: the briefing is grounded in actual source data at an explicit scope, not invented
prose. **Fail** if it produces a generic status summary with no real sources or scope.
