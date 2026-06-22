---
skill: daily-ops
---
# Eval: daily-ops

A failing-baseline eval — without the skill the agent gives a vague "here's your day"; with the
skill it assembles the operational dashboard from live sources.

## Baseline
Prompt the agent **without** the daily-ops skill loaded:

> "What's my operational status this morning?"

Observed baseline failure: the agent offers generic suggestions ("check your email, review open
tasks") without actually pulling CI status, calendar, inbox, or the task queue. No real dashboard,
nothing actionable.

## Pass
With the daily-ops skill loaded, the agent produces a dashboard from live data — morning brief, CI
status, calendar, emails, task queue.

Pass criterion: the dashboard reflects actual current state from each source, not generic advice.
**Fail** if it suggests checking things instead of pulling and presenting them.
