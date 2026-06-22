---
skill: client
---
# Eval: client

A failing-baseline eval — without the skill the agent handles a client request as a one-off; with
the skill it runs the lifecycle and tracks the engagement state.

## Baseline
Prompt the agent **without** the client skill loaded:

> "We've got a new client project — get it going."

Observed baseline failure: the agent jumps to whatever was mentioned (maybe a proposal) with no
onboarding, no scope/estimate, no contract, and no record of where the engagement stands. Steps are
missed and nothing is tracked.

## Pass
With the client skill loaded, the agent runs the lifecycle in order — onboard, scope, estimate,
propose, contract, build, handoff — and tracks state across the stages.

Pass criterion: the engagement moves through the defined lifecycle stages with state captured, not
an ad-hoc single step. **Fail** if it does one isolated task with no lifecycle structure or
tracking.
