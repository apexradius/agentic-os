---
skill: auto-planner
---
# Eval: auto-planner

A failing-baseline eval — without the skill the agent lists tasks in arbitrary order; with the
skill it builds a prioritized queue from real repo state with time blocks.

## Baseline
Prompt the agent **without** the auto-planner skill loaded:

> "Plan my work for today from the repo state."

Observed baseline failure: the agent dumps an unordered to-do list ignoring open issues, PR
status, and deadlines — no prioritization, no estimate, no sequencing. Low-value work could sit
above a blocking deadline.

## Pass
With the auto-planner skill loaded, the agent analyzes open issues, PRs, deadlines, and tech
debt, then produces a prioritized work queue with time blocks.

Pass criterion: the plan is derived from actual repo signals and ordered by priority with time
blocks. **Fail** if it returns an unordered list with no prioritization or grounding in repo
state.
