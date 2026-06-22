---
skill: gemma-eval
---
# Eval: gemma-eval

A failing-baseline eval — without the skill the agent judges a local model by feel; with the skill
it benchmarks it across capability dimensions with scores.

## Baseline
Prompt the agent **without** the gemma-eval skill loaded:

> "Is this local model good enough to use?"

Observed baseline failure: the agent tries one or two prompts and says "seems decent" — no
structured benchmark across reasoning, code generation, instruction following, or domain knowledge,
and no comparable score. The judgment is anecdotal.

## Pass
With the gemma-eval skill loaded, the agent runs the benchmark suite (reasoning, code gen,
instruction following, domain knowledge) and reports scores per dimension.

Pass criterion: the assessment is a multi-dimension benchmark with scores, comparable across models.
**Fail** if it returns an anecdotal "seems good" from a couple of prompts with no scored benchmark.
