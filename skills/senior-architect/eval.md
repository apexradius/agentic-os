---
skill: senior-architect
---
# Eval: senior-architect

A failing-baseline eval — without the skill the agent reaches for a fashionable architecture; with
the skill it designs for the team and constraints and records the decision.

## Baseline
Prompt the agent **without** the senior-architect skill loaded:

> "Design the architecture for our new product." (context: one engineer, one product, early
> stage)

Observed baseline failure: the agent proposes a microservices architecture with a message bus
and separate services "for scalability" — a distributed system for a solo team that has no scale
problem yet. All the operational cost, none of the benefit. No tradeoffs recorded, no trigger for
when to revisit.

## Pass
With the senior-architect skill loaded, the agent matches the design to the constraints (team
size, stage, real load), records it as an ADR with tradeoffs, and names the signal that would
justify changing course.

Pass criterion: the recommendation fits the actual context (a simple/modular monolith here),
documents tradeoffs and alternatives, and states the trigger to revisit (e.g. the metric at
which to split services). **Fail** if it prescribes microservices/over-engineering by default
with no fit-to-context and no recorded tradeoffs.
