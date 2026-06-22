---
skill: model-router
---
# Eval: model-router

A failing-baseline eval — without the skill the agent reaches for the biggest model by reflex;
with the skill it maps the task to the right tier on a cost/performance basis.

## Baseline
Prompt the agent **without** the model-router skill loaded:

> "Which model should run this nightly job that reformats 50k log lines into CSV?"

Observed baseline failure: the agent picks the top-tier model "to be safe," with no reasoning
about task difficulty or cost. A mechanical, high-volume transform gets billed at premium
reasoning rates for no quality gain.

## Pass
With the model-router skill loaded, the agent classifies the task (here: mechanical,
high-volume, low-reasoning) and routes it to the cheapest tier that meets the bar, naming the
cost/performance tradeoff.

Pass criterion: the choice is justified by task type and cost/perf — a cheap tier for this
mechanical job — not "biggest to be safe." **Fail** if it defaults to the top tier without a
task-fit rationale.
