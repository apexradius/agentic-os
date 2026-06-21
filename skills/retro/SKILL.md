---
name: retro
description: "Run a project retrospective — what went well, what didn't, what to change. Analyzes git history, issues, and session logs. Use after completing a project phase, or /retro."
user-invocable: true
argument-hint: "[project-or-timeframe]"
---

# Retrospective

Structured review of what happened, what worked, and what to improve.

## Data Gathering
1. `git log --oneline --since="[start]"` — what was built
2. Open/closed issues — what was planned vs delivered
3. Session summaries / progress.md — what the journey looked like
4. Memory entries — feedback received

## Framework: Start / Stop / Continue

### Start Doing
- Things we should add to our process
- Tools or practices that would help

### Stop Doing
- Things that wasted time or caused problems
- Patterns that didn't work

### Continue Doing
- Things that worked well
- Practices worth keeping

## Output
```markdown
# Retrospective: [Project/Sprint]
**Period**: [start] to [end]

## By the Numbers
- Commits: [N]
- Files changed: [N]
- Features shipped: [N]
- Bugs fixed: [N]

## What Went Well
- [specific wins with evidence]

## What Didn't Go Well
- [specific issues with root cause]

## Action Items
- [ ] [concrete change to make]
- [ ] [concrete change to make]

## Lessons Learned
- [insight that applies to future work]
```
