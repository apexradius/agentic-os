---
skill: git-flow
---
# Eval: git-flow

A failing-baseline eval — without the skill the agent commits everything to main in one blob;
with the skill it branches, commits atomically with conventions, and opens a PR.

## Baseline
Prompt the agent **without** the git-flow skill loaded, with several unrelated changes staged on
the default branch:

> "Commit and push my work."

Observed baseline failure: the agent runs `git add -A && git commit -m "updates"` directly on
`main` and pushes — one giant commit mixing unrelated changes, a non-descriptive message, no
branch, no PR. Impossible to review or revert cleanly.

## Pass
With the git-flow skill loaded, the agent creates a branch, splits the work into atomic commits
with conventional messages, and opens a PR.

Pass criterion: no direct commit to the default branch, commits are atomic with conventional
messages, and a PR is opened. **Fail** if it commits to `main`, bundles unrelated changes into
one commit, or uses a non-descriptive message.
