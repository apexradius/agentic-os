---
skill: estimate
---
# Eval: estimate

A failing-baseline eval — without the skill the agent guesses a number; with the skill it
decomposes the work and shows how the estimate is built, with its assumptions.

## Baseline
Prompt the agent **without** the estimate skill loaded:

> "How long will it take to build the customer portal?"

Observed baseline failure: the agent answers "about two weeks" with no breakdown — a single
number pulled from the air, no scope decomposition, no assumptions, no risk buffer. Untestable
and almost certainly wrong.

## Pass
With the estimate skill loaded, the agent decomposes scope into tasks, estimates effort per
task, and rolls up to a timeline/cost with stated assumptions and a risk buffer.

Pass criterion: the estimate is a built-up breakdown (scope → per-task effort → total) with
explicit assumptions and a buffer/range — not a single bare number. **Fail** if it returns one
figure with no decomposition or assumptions.
