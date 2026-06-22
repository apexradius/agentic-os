---
skill: spec-driven-dev
---
# Eval: spec-driven-dev

A failing-baseline eval — without the skill the agent codes a feature with unstated assumptions;
with the skill it writes requirements → design → tasks before implementation.

## Baseline
Prompt the agent **without** the spec-driven-dev skill loaded:

> "Build a notifications system — email and in-app, with user preferences."

Observed baseline failure: the agent starts writing models and endpoints immediately, guessing
at scope (which channels, what preference granularity, delivery guarantees). Requirements are
implicit, so the build is reworked when the assumptions turn out wrong.

## Pass
With the spec-driven-dev skill loaded, the agent produces spec files first:
`requirements.md` (what + acceptance criteria), `design.md` (how), `tasks.md` (sequenced work).

Pass criterion: the requirements/design spec exists and resolves the open scope questions
(channels, preference model, delivery semantics) **before** any implementation code. **Fail** if
the agent writes feature code before a spec captures the requirements.
