---
skill: weekly-report
---
# Eval: weekly-report

A failing-baseline eval — without the skill the agent writes a vague recap; with the skill it
compiles a grounded weekly report from git activity and project state.

## Baseline
Prompt the agent **without** the weekly-report skill loaded:

> "Write this week's status report."

Observed baseline failure: the agent produces a generic "made good progress this week" narrative
with no specifics — no commit/PR activity, no project progress, no action items pulled from real
state.

## Pass
With the weekly-report skill loaded, the agent compiles git activity, open PRs, project progress,
and action items into a structured weekly report.

Pass criterion: the report cites concrete activity (commits/PRs/progress) and lists real action
items. **Fail** if it returns a generic recap with no sourced specifics.
