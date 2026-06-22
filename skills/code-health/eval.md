---
skill: code-health
---
# Eval: code-health

A failing-baseline eval — without the skill the agent gives a vibe ("the code is pretty good");
with the skill it returns a 0-100 score backed by measured dimensions.

## Baseline
Prompt the agent **without** the code-health skill loaded:

> "How healthy is this codebase?"

Observed baseline failure: the agent skims a few files and answers "looks reasonably healthy,
fairly clean" — an unquantified impression. No measurement of coverage, duplication, complexity,
dependency freshness, or type safety; no number; nothing comparable run-over-run.

## Pass
With the code-health skill loaded, the agent measures the health dimensions (complexity, test
coverage, duplication, dependency freshness, type safety) and computes a 0-100 score.

Pass criterion: the output is a numeric score with each contributing dimension shown and the
weakest areas called out. **Fail** if it returns a subjective assessment with no measured
dimensions and no score.
