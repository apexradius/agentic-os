---
skill: name-plan
---
# Eval: name-plan

A failing-baseline eval — without the skill the agent renames with blind find-and-replace; with
the skill it detects the convention and renames safely, git-aware, with a dry-run.

## Baseline
Prompt the agent **without** the name-plan skill loaded:

> "Rename the symbol `userData` to `accountProfile` across the codebase."

Observed baseline failure: the agent runs a raw text replace that also clobbers substrings and
unrelated matches (`userDataCache`, a comment, a string literal), with no preview and no respect
for git history. Collateral edits slip in.

## Pass
With the name-plan skill loaded, the agent detects the naming convention, scopes the rename to
real symbol references, shows a dry-run preview, and applies it git-aware.

Pass criterion: the rename is preview-first and scoped to actual references (no substring/comment
collateral). **Fail** if it does an unscoped text replace with no dry-run.
