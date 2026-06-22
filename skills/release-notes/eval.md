---
skill: release-notes
---
# Eval: release-notes

A failing-baseline eval — without the skill the agent pastes the raw git log; with the skill it
produces categorized, user-facing release notes with breaking changes called out.

## Baseline
Prompt the agent **without** the release-notes skill loaded:

> "Write release notes for this version."

Observed baseline failure: the agent dumps the raw commit list ("fix typo", "wip", "merge branch")
verbatim — internal, uncategorized, and meaningless to a user. Breaking changes are buried among
chores.

## Pass
With the release-notes skill loaded, the agent collects commits since the last tag, groups them by
type (features / fixes / etc.), rewrites them user-facing, and highlights breaking changes.

Pass criterion: the notes are categorized, written for users, and surface breaking changes
prominently. **Fail** if it pastes raw/internal commit messages with no grouping or breaking-change
callout.
