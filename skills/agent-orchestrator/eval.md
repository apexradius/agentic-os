---
skill: agent-orchestrator
---
# Eval: agent-orchestrator

A failing-baseline eval — without the skill the agent does multi-part work serially in one
context; with the skill it decomposes into a dependency-aware, model-tiered agent plan.

## Baseline
Prompt the agent **without** the agent-orchestrator skill loaded:

> "Research three competitors, then synthesize a positioning brief."

Observed baseline failure: the agent does all three research passes sequentially in its own
context (slow, context-bloating) with no parallelism, no model tiering, and no defined handoff
into the synthesis step.

## Pass
With the agent-orchestrator skill loaded, the agent builds a DAG: three independent research
tasks fan out in parallel (cheaper tier), then a synthesis task depends on their typed outputs,
with context kept lean.

Pass criterion: independent work is parallelized with explicit dependencies and a tiered
model choice, and the synthesis consumes the upstream outputs. **Fail** if the work runs serially
in one context with no decomposition or dependency structure.
