---
skill: test-gen
---
# Eval: test-gen

A failing-baseline eval — without the skill the agent writes tautological tests that mirror the
implementation; with the skill it writes meaningful tests that match project conventions and
cover edge + error paths.

## Baseline
Prompt the agent **without** the test-gen skill loaded:

> "Add tests for this module."

Observed baseline failure: the agent writes tests that restate the implementation (asserting the
function returns exactly what it computes via the same logic), or only a single happy-path case.
The suite passes but would not catch a real regression, and it ignores the project's existing
test style.

## Pass
With the test-gen skill loaded, the agent detects the framework, reads existing tests to match
their patterns, and generates cases across happy path, edge cases (empty/null/boundary), and
error paths.

Pass criterion: the generated tests follow the repo's existing framework and structure and
include at least one edge-case and one error-path test that could fail if the logic broke.
**Fail** if the tests merely mirror the implementation, cover only the happy path, or ignore the
project's test conventions.
