---
skill: morning-brief
---
# Eval: morning-brief

A failing-baseline eval — without the skill the agent gives generic good-morning advice; with the
skill it delivers a prioritized brief from the day's real signals.

## Baseline
Prompt the agent **without** the morning-brief skill loaded:

> "Give me my morning brief."

Observed baseline failure: the agent responds with generic encouragement and "review your
priorities" — no actual pull of overnight changes, today's calendar, urgent email, or top tasks.
Nothing to act on.

## Pass
With the morning-brief skill loaded, the agent pulls the day's real signals (overnight activity,
calendar, urgent inbox, top tasks) into a prioritized brief.

Pass criterion: the brief reflects actual current data and leads with the day's top priorities.
**Fail** if it offers generic motivation instead of sourced, prioritized items.
