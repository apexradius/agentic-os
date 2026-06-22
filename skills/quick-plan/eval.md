---
skill: quick-plan
---
# Eval: quick-plan

A failing-baseline eval — without the skill the agent either over-plans or dives in blind; with
the skill it emits a tight, decision-complete outline without executing.

## Baseline
Prompt the agent **without** the quick-plan skill loaded:

> "Give me a quick plan to add CSV export to the reports page — just the plan, don't build it."

Observed baseline failure: the agent either starts editing files anyway, or returns a vague
two-line "add a button and an endpoint" with no file list, no steps, no risks — not actionable.

## Pass
With the quick-plan skill loaded, the agent returns a step-by-step outline with the affected file
list, complexity, risks, and commit boundaries — and does **not** start implementing.

Pass criterion: a concrete, ordered plan with files + risks is produced and no code is written.
**Fail** if the agent implements instead of planning, or returns a plan too vague to act on.
