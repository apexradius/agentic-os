---
name: briefing
description: "Unified briefing system — session summary, daily ops, weekly report. Auto-detects scope or specify. Pulls from git, CI, calendar, email, tasks. Use when needing a status update, briefing, summary, or /briefing."
user-invocable: true
argument-hint: "[session|daily|weekly]"
---

# Briefing — Status Intelligence

One command, any scope. Pulls from all data sources available.

> **Absorbed aliases:** `daily-ops`, `morning-brief`, `weekly-report` → use `/briefing [daily|weekly]`.

## Scope Detection
- "what did we do" / "session summary" → **Session**
- "morning" / "today" / "daily" → **Daily**
- "weekly" / "this week" / "status report" → **Weekly**

## Session Briefing
```markdown
# Session Summary — [date]
## Completed
- [what was built/fixed/shipped]
## Files Changed
- [list with +/- line counts]
## Decisions Made
- [key decisions and reasoning]
## Still Open
- [unfinished work]
## Memory Saved
- [new memories created this session]
```

Source: conversation context + git diff

## Daily Briefing
```markdown
# Daily Ops — [date]

## CI Status
| Repo | Status | Last Run |
[from: gh run list across active repos]

## Git Activity
- Commits today: [N]
- Open PRs: [list]
- Stale issues (>7 days): [list]

## Calendar (if Google Calendar MCP connected)
- Today's meetings: [list with times]
- Next free block: [time]

## Email (if Gmail MCP connected)
- Unread: [N]
- Important/starred: [list]

## Tasks
- In progress: [list]
- Blocked: [list]
- Next up: [top 3 priorities]

## Priority Actions
1. [most important thing to do]
2. [second most important]
3. [third]
```

## Weekly Report
```markdown
# Weekly Report — [date range]

## Highlights
- [top 3 accomplishments]

## Metrics
- Commits: [N]
- PRs merged: [N]
- Issues closed: [N]

## Projects Status
| Project | Status | Progress | Next Milestone |
[from: active repos and task lists]

## Blockers
- [anything stalled and why]

## Next Week Priorities
1. [goal]
2. [goal]
3. [goal]
```

## Data Sources (use what's available)
- `git log` — commit history
- `gh` CLI — PRs, issues, CI runs
- Google Calendar MCP — meetings
- Gmail MCP — important emails
- Task list — active tasks
- Memory — project context
