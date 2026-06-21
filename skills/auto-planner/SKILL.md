---
name: auto-planner
description: "Autonomous work planning — analyze open issues, PRs, deadlines, technical debt. Generate prioritized work queue with time blocks. Use when needing automated task prioritization from repo state."
argument-hint: "[timeframe: today|this-week]"
---

# Auto Planner

## Data Sources
- Open GitHub issues: `!gh issue list 2>/dev/null`
- PR review requests: `!gh pr list --search "review-requested:@me" 2>/dev/null`
- Recent commits: `!git log --since="3 days ago" --oneline 2>/dev/null`
- Project files for deadlines and milestones

## Scoring (each item)
| Factor | Weight | How |
|--------|--------|-----|
| Urgency | 30% | Deadline proximity (overdue = max) |
| Impact | 30% | Revenue/user impact, blocking others |
| Effort | 20% | Estimated hours (prefer quick wins) |
| Dependencies | 20% | Blocked/blocking other work |

## Output
Prioritized work queue:
1. **[Priority] Task** — estimated time, why it matters, what it unblocks
2. ...

Time-block suggestions for $ARGUMENTS:
- 9:00-10:30 — Deep work: [highest priority task]
- 10:30-11:00 — Reviews: [PR reviews]
- 11:00-12:00 — Meetings/communication
- 13:00-15:00 — Deep work: [second priority]
- 15:00-16:00 — Admin/email/planning
