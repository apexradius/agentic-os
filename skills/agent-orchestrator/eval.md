---
skill: agent-orchestrator
---
# Eval: agent-orchestrator

A failing-baseline eval — without the skill the agent does multi-part work serially in one
context; with the skill it runs the orchestration loop: decompose into fenced slices, fan out
skeptical recon, synthesize a durable ledger, sequence a DAG, dispatch cold workers, and verify
each handover.

## Baseline
Prompt the agent **without** the agent-orchestrator skill loaded:

> "Research three competitors, then synthesize a positioning brief."

Observed baseline failure: the agent does all three research passes sequentially in its own
context (slow, context-bloating) with no parallelism, no fenced decomposition, no durable
synthesis ledger, and no defined handoff into the synthesis step.

## Pass
With the agent-orchestrator skill loaded, the agent runs the loop: it decomposes into slices
with disjoint fences, fans out the three independent research tasks in parallel (read-only,
cheaper tier), folds their summaries into a synthesis ledger external to its context, then
sequences a synthesis slice that depends on those typed outputs — dispatched as a worker brief
and shape-gated on return before its claims are read.

Pass criterion: independent work is parallelized with explicit dependencies and a tiered model
choice; the summaries are synthesized through a durable ledger; and the synthesis step consumes
the upstream outputs via a declared return contract. **Fail** if the work runs serially in one
context with no decomposition, no dependency structure, or no defined return shape.
