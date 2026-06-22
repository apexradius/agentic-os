---
skill: n8n-debug
---
# Eval: n8n-debug

A failing-baseline eval — without the skill the agent guesses at a workflow failure; with the
skill it classifies the error, reads the execution log, and finds the real cause.

## Baseline
Prompt the agent **without** the n8n-debug skill loaded:

> "My n8n workflow keeps failing. Fix it."

Observed baseline failure: the agent guesses ("maybe re-add the node / re-enter the
credential"), changes things blindly, and doesn't read the failed execution. The actual cause —
e.g. an expression referencing a renamed field, or a 429 from an upstream node — is never
identified.

## Pass
With the n8n-debug skill loaded, the agent classifies the error type, reads the failed
execution's logs/node output, and isolates the failing node and root cause before changing
anything.

Pass criterion: the diagnosis names the specific failing node and root cause from the execution
data, then proposes a targeted fix. **Fail** if it changes nodes blindly without reading the
execution or naming the cause.
