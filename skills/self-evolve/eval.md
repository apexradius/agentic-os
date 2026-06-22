---
skill: self-evolve
---
# Eval: self-evolve

A failing-baseline eval — without the skill a correction is acknowledged and forgotten; with the
skill it is captured as a durable memory so it isn't repeated.

## Baseline
Correct the agent on something, then prompt **without** the self-evolve skill loaded:

> "No — we always run migrations behind a feature flag here, not directly."

Observed baseline failure: the agent says "got it, understood" and moves on. Nothing is written
to memory; the same mistake recurs in a later session because the correction lived only in this
conversation.

## Pass
With the self-evolve skill loaded, the agent captures the correction (and confirmed non-obvious
approaches) as a feedback memory — the rule plus why it matters — so future sessions inherit it.

Pass criterion: a durable memory entry is written recording the corrected behavior and its
rationale. **Fail** if the agent only verbally acknowledges the correction without persisting it.
