---
name: morning-brief
description: "Daily morning briefing — open PRs, failing CI, stale issues, yesterday's activity, prioritized action list. Use when starting your morning, checking what needs attention, or /morning-brief."
user-invocable: true
disable-model-invocation: true
---

# Morning Brief

## Gather
- Open PRs: `!gh pr list 2>/dev/null || echo "no gh cli"`
- Open issues: `!gh issue list 2>/dev/null || echo "no gh cli"`
- Yesterday's commits: `!git log --since="yesterday" --oneline 2>/dev/null`
- Failing CI: `!gh run list --status failure --limit 5 2>/dev/null`

## Output
### 🔴 Urgent (fix today)
- Failing CI, blocking PRs, overdue items

### 🟡 Important (this week)
- Open PR reviews, active issues, planned features

### 🟢 Nice to have
- Code cleanup, documentation, optimization

### Yesterday's Activity
Summary of commits and changes made.
