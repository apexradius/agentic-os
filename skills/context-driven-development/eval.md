---
skill: context-driven-development
---
# Eval: context-driven-development

A failing-baseline eval — without the skill the agent implements with the project context only in
its head; with the skill it scaffolds and consults durable context artifacts first.

## Baseline
Prompt the agent **without** the context-driven-development skill loaded, on a fresh project:

> "Start building the product."

Observed baseline failure: the agent begins coding with no product/tech-stack/workflow artifacts.
The product intent, stack decisions, and conventions live only in the conversation, so later work
drifts and contradicts earlier choices after a reset.

## Pass
With the context-driven-development skill loaded, the agent scaffolds the context artifacts
(product.md, tech-stack.md, workflow.md, tracks.md) and validates them before implementation,
syncing them as the project evolves.

Pass criterion: the durable context artifacts exist and are consulted/validated before code is
written. **Fail** if implementation starts with no context artifacts and the project intent lives
only in chat.
