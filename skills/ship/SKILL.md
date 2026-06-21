---
name: ship
description: "Quick ship for low-risk changes — test, commit, push, PR. No security scan, no canary, no version bump. Use for /ship or quick pushes."
user-invocable: true
---

# Ship — Quick Push

Lightweight shipping for low-risk changes (copy fixes, config tweaks, small bug fixes). For full production releases, use `/release`.

## Steps

1. Confirm not on main/master
2. `git fetch origin && git merge origin/[base] --no-edit`
3. Run tests — if they fail, stop and report
4. `git diff origin/[base]...HEAD --stat` — quick summary
5. `git add -A && git commit -m "[message]"` with Co-Authored-By
6. `git push -u origin [branch]`
7. `gh pr create --title "[title]" --body "[summary]"`
8. Report: PR URL + what shipped

## When to Use Ship vs Release

| Ship | Release |
|------|---------|
| Copy/typo fixes | New features |
| Config changes | Breaking changes |
| Non-logic CSS tweaks | Security-sensitive code |
| Documentation updates | Database migrations |
| Dependency bumps (patch) | Version bumps (minor/major) |

## Rules

- Never push to main/master — always PR
- Never skip tests — if they fail, stop
- If no tests exist, warn but continue
- If changes touch auth, API, or DB — escalate to `/release`
