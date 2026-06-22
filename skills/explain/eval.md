---
skill: explain
---
# Eval: explain

A failing-baseline eval — without the skill the agent paraphrases the syntax; with the skill it
traces execution and surfaces the business intent and complexity.

## Baseline
Prompt the agent **without** the explain skill loaded:

> "What does this function do?" (a non-trivial function with a recursive call and an early-return
> edge case)

Observed baseline failure: the agent restates the code line-by-line in prose ("it loops over the
items and calls itself") without explaining *why*, what the edge case guards against, or where it
fits in the system. A translation, not an explanation.

## Pass
With the explain skill loaded, the agent parses the target, traces the execution path including
the edge case, identifies dependencies, and states the business intent and complexity.

Pass criterion: the explanation covers what the code is *for* (intent), how control flows through
the edge case, and its dependencies — not just a restatement of syntax. **Fail** if it
paraphrases the code without intent, the edge-case behavior, or its place in the system.
