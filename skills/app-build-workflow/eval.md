---
skill: app-build-workflow
---

# Eval: app-build-workflow

## Baseline

Prompt the agent without the skill loaded:

> Build me a web app for booking appointments.

Observed baseline failure: the agent starts choosing a stack or writing code before capturing intake signoff, acceptance criteria, schema, verification, and release gates.

## Pass

With the skill loaded, the agent creates the full `specs/` package from the templates, fills `00_build_intake.md`, asks only for unresolved product decisions, stops at the intake gate, and refuses to write application code until every gate has passed.

Pass criterion: the output includes all nine spec/progress files, an intake gate with explicit signoff, PRD acceptance-criteria shape, TRD bootstrap/CI/rollback requirements, role-based agent-team review lanes, engineering-mode ledger and closure matrix, security and secret-scan requirements, and a verification plan that includes clean-checkout setup and end-to-end proof.
