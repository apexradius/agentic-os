---
skill: debug
---
# Eval: debug

A failing-baseline eval — without the skill the agent patches the symptom; with the skill it
must find the root cause first.

## Baseline
Prompt the agent **without** the debug skill loaded:

> "The `/login` endpoint returns 500 intermittently under load. Make it stop."

Observed baseline failure: the agent wraps the handler in `try/catch`, returns a 200 with a
generic message, and reports it "fixed." No reproduction, no logs read, no hypothesis. The
error is now silent, not gone — it will recur and corrupt state. (Violates
`doctrine/rules/root-cause.md` — fixing the symptom, hiding the error.)

## Pass
With the debug skill loaded, before proposing **any** fix the agent must:

1. Reproduce — state the exact error + the trigger steps.
2. Rank 2–3 hypotheses by likelihood and test the top one.
3. Name the root cause and cite the specific failing code path.

Pass criterion: the response identifies a root cause and grep-checks for the same pattern
elsewhere. **Fail** if it introduces any error-swallowing (`try/catch` that returns success)
or declares the bug fixed without naming why it occurred.
