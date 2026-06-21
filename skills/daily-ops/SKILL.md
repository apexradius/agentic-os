---
name: daily-ops
description: "Daily operations dashboard — morning brief, CI status, calendar, emails, task queue. Orchestrates 5+ skills. Use when starting your workday, checking daily status, or /daily-ops."
user-invocable: true
argument-hint: ""
---

# Daily Ops — Operations Dashboard

Comprehensive daily briefing combining all operational data sources.

## Orchestrated Skills
1. `/morning-brief` → PRs, CI status, stale issues, activity
2. `/work-queue` → Pending tasks and priorities
3. `/scheduled-report` → Any scheduled reports due today
4. Google Calendar → Today's meetings and free time
5. Gmail → Unread important emails and pending replies

## Sections

### 1. Good Morning Summary
- Date, weather note (if available)
- High-level status: all green / issues to address

### 2. CI & Repos (morning-brief + multi-repo)
For all active repos (especially the 10 Shopify themes):
- CI status: passing / failing / no recent runs
- Open PRs needing review
- Stale issues (>7 days no activity)

### 3. Calendar (Google Calendar MCP)
- Today's meetings with times and links
- Tomorrow's first meeting (for planning)
- Available focus time blocks

### 4. Email (Gmail MCP)
- Unread count
- Important/starred messages needing response
- Client emails (from known client domains)

### 5. Task Queue (work-queue)
- Active tasks in progress
- Blocked tasks (and what's blocking them)
- Next 3 tasks to tackle today

### 6. Business Metrics (client-pipeline report, if applicable)
- New leads (last 24h)
- Active projects status
- Pending estimates/invoices

### 7. Priority Actions
Ranked list of the 5 most important things to do today, derived from all the above data.

## When to Use
- First thing in the morning
- After returning from a break
- When context-switching between projects
- Via `/loop 2h /daily-ops` for periodic check-ins
