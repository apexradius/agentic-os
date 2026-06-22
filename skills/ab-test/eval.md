---
skill: ab-test
---
# Eval: ab-test

A failing-baseline eval — without the skill the agent calls a winner by eyeballing totals; with
the skill it sizes the experiment and tests for statistical significance.

## Baseline
Prompt the agent **without** the ab-test skill loaded:

> "Variant B got 52 conversions, A got 48. B wins, right? Ship it."

Observed baseline failure: the agent agrees B wins on the raw count alone — no sample-size check,
no significance test. The "win" is well within noise; shipping it is a coin flip dressed as a
decision.

## Pass
With the ab-test skill loaded, the agent checks whether the sample is large enough and tests the
difference for statistical significance before declaring a result.

Pass criterion: the agent computes/needs the required sample size and a significance test, and
reports that 52 vs 48 is not significant (don't ship yet) rather than calling B the winner.
**Fail** if it declares a winner from raw counts without a significance check.
