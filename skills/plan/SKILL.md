---
name: plan
description: "Smart planning — auto-detects complexity and picks the right approach: quick outline for simple tasks, file-based planning for multi-step work, full spec-driven for features. Use when planning anything, breaking down work, or /plan."
user-invocable: true
argument-hint: "[task-or-feature-description]"
---

# Plan — Adaptive Planning System

Detects task complexity and applies the right planning depth.

## Complexity Estimator

Complexity is NOT just step count. Evaluate all three dimensions:

| Dimension | Low (1) | Medium (2) | High (3) |
|-----------|---------|------------|----------|
| **Files affected** | 1-2 files | 3-7 files | 8+ files |
| **API/external calls** | 0 | 1-3 (well-known) | 4+ or unfamiliar APIs |
| **State changes** | Local only | Single service state | Multi-service, DB migrations, or deployment state |

**Scoring:** Sum the three scores.
- 3-4 = **Light** (quick outline)
- 5-7 = **Medium** (file-based planning)
- 8-9 = **Heavy** (spec-driven development)

Legacy heuristic (still valid as tiebreaker): <5 steps = Light, 5-15 = Medium, 15+ = Heavy.

## Level 1: Quick Outline (Light)
Output directly in conversation:
```
## Plan: [Task]
Complexity: [score] (files: [N], APIs: [N], state: [N])
1. [step]
2. [step]
3. [step]
Ready to start? (y/n)
```

## Level 2: File-Based Planning (Medium)
Create persistent files in project root:

**task_plan.md** — Objective, phases with status, decisions, risks
**progress.md** — Append-only log of completed work (see Progress Tracking below)
**findings.md** — Research, discoveries, failure log (see Failure Logging below)

Rules:
- Re-read plan before each decision (refreshes context)
- Update after completing each phase
- Record decisions WITH reasons
- After compaction or /clear, re-read all three files first
- **DDADD filter** — before adding a task: Do (urgent+important or <2min), Delay (deferrable), Automate (repeated/scriptable), Delegate (outsource cheaper), Delete (not needed)
- **VNA (Very Next Action)** — end every phase with a specific next step that survives context reset. "The plan is ready" is not a VNA. "Run `bash tests/test-hooks.sh` to verify" is.

## Level 3: Spec-Driven (Heavy)
Create in `specs/` directory:

**[feature].requirements.md** — User stories + acceptance criteria
**[feature].design.md** — Architecture decision, data model, API, error handling
**[feature].tasks.md** — Phased task breakdown with estimates + definition of done

Rules:
- Never write code before specs exist
- Acceptance criteria must be testable (see Plan Verification Loop below)
- Update specs when reality diverges
- One spec set per feature

## Plan Verification Loop

Before finalizing any Medium or Heavy plan, verify every acceptance criterion:

1. **Testability check**: For each acceptance criterion, ask: "Can I write a concrete test or verification command for this?" If the answer is no, rewrite it.
2. **Rewrite vague criteria**: "Works correctly" becomes "Returns 200 for valid input, 422 for missing required fields, verified by `curl` commands in test plan." "Looks good" becomes "Matches Figma spec within 2px, verified by screenshot diff."
3. **Exit gate**: Plan is not ready until every acceptance criterion has a verification method (test command, API call, visual check, or measurable metric).

## Progress Tracking

`progress.md` must be updated after EVERY step, not just phases. Each entry follows this format:

```markdown
## [timestamp] Step: [step description]
- Status: done | blocked | skipped
- Reason: [why — especially for blocked/skipped]
- Output: [key result, command output summary, or artifact created]
- VNA: [next concrete action]
```

**Blocked steps** must include: what's blocking, what was tried, and what would unblock it.
**Skipped steps** must include: why it was skipped and whether it needs revisiting.

## Failure Logging

`findings.md` serves double duty — research context AND failure log. Failures are logged under a dedicated section:

```markdown
## Failure Log

### [timestamp] [what failed]
- **Root cause**: [specific technical reason]
- **What was tried**: [approaches attempted]
- **Resolution**: [what fixed it] | **Unresolved**: [what's still broken]
- **Prevention**: [how to avoid this in future — config change, test, guard]
```

Before attempting any fix, search `findings.md` for prior failures on the same topic. Repeating a known-failed approach is a skill violation.

## Escalation

Start light. If you discover the task is more complex than expected:
- Light -> Medium: create task_plan.md mid-task
- Medium -> Heavy: create specs/ from task_plan.md findings

### Auto-Escalation Triggers

Escalation is NOT optional when these conditions are met:

1. **3+ failures on the same step**: If a step has failed 3 times (logged in findings.md), escalate to the next complexity level or pause and ask the user for direction.
2. **>50% scope growth**: If the number of steps in the plan has grown by more than 50% from the original estimate, the plan was wrong. Stop, re-plan at the next complexity level.
3. **Cross-service cascade**: If a change that was scoped to one service now requires changes in 2+ additional services, escalate.

When auto-escalation fires, announce it: "Escalating from [level] to [level]: [trigger reason]." Do not silently continue at the wrong planning depth.

## Session Recovery
On resume, check for existing planning files:
1. `specs/*.md` -> heavy plan active, read and continue
2. `task_plan.md` -> medium plan active, read and continue
3. Neither -> start fresh

## PIV Loop (for Agentic Coding Tasks)
Use when implementing complex features with an AI agent:

1. **Prime** — Agent reads core docs, project structure, PRD
2. **Vibe plan** — Describe goals in natural language; agent asks 10+ clarifying questions
3. **Generate structured plan** — Markdown with goal criteria, file list, validation strategy
4. **Context reset** — Start new conversation with only the structured plan (removes distractors)
5. **Implement** — Agent works autonomously in isolated sandbox
6. **E2E validate** — Browser automation or test suite; review artifacts not just diffs

90/10 rule: 90% of session time in planning before touching code.

## Context Management
- **Compaction trigger**: When token count exceeds 250K-300K, run `/compact` — reasoning quality degrades beyond this point
- **WHISK Framework**: Write (externalize memory) -> Isolate (sub-agents) -> Select (just-in-time context) -> Compress (delay compaction as long as possible)
- **After compaction**: Re-read task_plan.md, progress.md, and findings.md before resuming
- **Context reset**: Start fresh conversation with plan file as sole input for clean implementation sessions
