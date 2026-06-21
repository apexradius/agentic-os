---
name: release-notes
description: "Generate release notes from git commits since last tag — categorized by type, breaking changes highlighted. Use when creating release notes, changelogs, or /release-notes."
user-invocable: true
disable-model-invocation: true
argument-hint: "[version]"
---

# Release Notes

## Data
- Previous tag: `!git tag -l | sort -V | tail -2 | head -1`
- Commits since: `!git log $(git tag -l | sort -V | tail -2 | head -1)..HEAD --oneline`

## Output Structure
### Breaking Changes (if any)
### Features
### Bug Fixes
### Performance
### Documentation
### Other

Categorize by conventional commit prefix (feat/fix/perf/docs/refactor/test). Include PR links where available. Thank contributors by name.
