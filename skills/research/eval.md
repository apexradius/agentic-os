---
skill: research
---
# Eval: research

A failing-baseline eval — without the skill the agent answers from memory or a single page; with
the skill it runs breadth-first across sources and synthesizes a comparison.

## Baseline
Prompt the agent **without** the research skill loaded:

> "Which background-job queue should we use — and why?"

Observed baseline failure: the agent answers from training memory ("use Redis/Sidekiq, it's
popular"), citing nothing current, comparing nothing. One opinion, no breadth, possibly stale.

## Pass
With the research skill loaded, the agent gathers multiple current sources (parallel where
possible) and synthesizes a comparison across the real options.

Pass criterion: the answer compares ≥3 options across consistent dimensions, cites current
sources, and ends with a justified recommendation — not a single remembered opinion. **Fail** if
it answers from memory alone or evaluates only one option.
