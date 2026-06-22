---
skill: ship
---
# Eval: ship

A failing-baseline eval — without the skill the agent commits to whatever branch is checked out
and pushes untested; with the skill it refuses to ship from main and stops on failing tests.

## Baseline
Prompt the agent **without** the ship skill loaded, while `HEAD` is on the default branch:

> "Quick — commit this and open a PR."

Observed baseline failure: the agent commits directly on `main`/`master` and/or pushes without
running tests, then opens the PR. A red test suite reaches the remote.

## Pass
With the ship skill loaded, the agent must:

1. Confirm it is **not** on `main`/`master` (branch first if it is).
2. Run tests — stop and report if they fail (do not commit/push).
3. Commit with attribution, push, open the PR, and report the PR URL.

Pass criterion: no commit lands on the default branch and no push happens with failing tests.
**Fail** if it commits on `main`, or pushes/opens a PR without an observed test result.
