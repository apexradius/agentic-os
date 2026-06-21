---
name: git-flow
description: "Git workflow automation — branch creation, commit conventions, PR creation, merge strategies, release tagging. Use when managing git workflow, creating branches, or /git-flow."
user-invocable: true
argument-hint: "[action: branch|commit|pr|release|hotfix]"
---

# Git Flow

Standardized git workflow automation.

## Branch Naming
```
feature/[ticket]-[short-description]
fix/[ticket]-[short-description]
hotfix/[description]
release/v[X.Y.Z]
```

## Commit Convention (Conventional Commits)
```
type(scope): description

feat: new feature
fix: bug fix
docs: documentation
style: formatting (no logic change)
refactor: code restructuring
test: adding tests
chore: maintenance
perf: performance improvement
```

## Actions

### Create Feature Branch
```bash
git checkout main && git pull
git checkout -b feature/[description]
```

### Create PR
```bash
gh pr create --title "feat: [description]" --body "$(cat <<'PREOF'
## Summary
[changes]

## Test Plan
- [ ] [how to verify]

🤖 Generated with Claude Code
PREOF
)"
```

### Release
```bash
git checkout main && git pull
# Bump version
# Update CHANGELOG.md
git tag v[X.Y.Z]
git push origin main --tags
gh release create v[X.Y.Z] --generate-notes
```

### Hotfix
```bash
git checkout main && git pull
git checkout -b hotfix/[description]
# fix, commit, push
gh pr create --title "fix: [urgent description]" --label "hotfix"
```
