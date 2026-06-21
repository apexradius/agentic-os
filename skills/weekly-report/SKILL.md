---
name: weekly-report
description: "Generate weekly status report — git activity, open PRs, project progress, action items. Use when creating weekly reports, status updates, or /weekly-report."
user-invocable: true
argument-hint: "[project-name-or-path]"
---

# Weekly Report

## Data Sources
- Git log: `!git log --since="7 days ago" --oneline`
- Open PRs: `!gh pr list`
- Open issues: `!gh issue list`

## Output Structure
1. **Accomplishments** — completed features, bugs fixed, PRs merged
2. **In Progress** — active branches, open PRs
3. **Blocked** — issues waiting on external input
4. **Next Week** — priorities and planned work
5. **Key Metrics** — commits, files changed, lines added/removed
