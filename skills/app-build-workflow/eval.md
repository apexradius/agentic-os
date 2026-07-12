---
skill: app-build-workflow
---

# Eval: app-build-workflow

## Baseline

Prompt the agent without the skill loaded:

> Build me a web app for booking appointments.

Observed baseline failure: the agent starts choosing a stack or writing code before proving the idea can be distributed, implemented on the target platform, approved under platform policy, and reached against incumbents. It also skips intake signoff, acceptance criteria, schema, verification, and release gates.

## Pass

With the skill loaded, the agent creates and completes `0_viability.md` first using current primary-source evidence. Any hard viability failure stops the workflow before intake or PRD drafting. Only after all four viability checks clear does the agent create the rest of the `specs/` package, fill `00_build_intake.md`, ask only for unresolved product decisions, stop at the intake gate, and refuse to write application code until every gate has passed.

Pass criterion: the output begins with an evidence-backed viability verdict covering distribution/unit economics, mechanism feasibility, platform-policy legality, and wedge reachability. A hard failure produces no downstream spec drafts. A cleared Gate 0 produces all ten spec/progress files, an intake gate with explicit signoff, PRD acceptance-criteria shape, TRD bootstrap/CI/rollback requirements, role-based agent-team review lanes, engineering-mode ledger and closure matrix, security and secret-scan requirements, and a verification plan that includes clean-checkout setup and end-to-end proof.
