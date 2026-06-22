---
skill: refactor
---
# Eval: refactor

A failing-baseline eval — without the skill "refactor" silently changes behavior; with the
skill it preserves behavior and proves it with tests.

## Baseline
Prompt the agent **without** the refactor skill loaded:

> "Refactor this 200-line function to be cleaner." (the function has no test coverage)

Observed baseline failure: the agent rewrites the function and, in the process, changes an edge
case (e.g. drops a null guard, flips a boundary condition) — a behavior change shipped under the
banner of "refactor." No test confirms behavior is unchanged.

## Pass
With the refactor skill loaded, the agent applies a named pattern (extract-function,
simplify-conditionals, etc.) while holding behavior constant, and establishes a safety net.

Pass criterion: behavior is preserved (a characterization test or existing tests pass before
and after) and the change is one named pattern, not a rewrite. **Fail** if any observable
behavior changes, or if the function is refactored with no test asserting equivalence.
