---
name: checkpoint
description: "Save working state for seamless resume — git state, decisions, VNA, remaining work. Pairs with /post-compact for restore. Use for /checkpoint, end of session, or context switch."
user-invocable: true
---

# Checkpoint — Save and Resume

Capture working state so any future session or post-compaction recovery resumes exactly where you left off.

## Storage Formats

### YAML Ledger (primary) — `.claude/session-ledger.yaml`
Structured, machine-readable. Used by `/post-compact` for symbol-level recovery.

### Markdown checkpoint (secondary) — `.claude/checkpoint.md`
Human-readable summary. Written alongside the ledger during transition period.

**Migration rule:** New sessions create the ledger from scratch. Old `checkpoint.md` without a matching ledger is a read-only fallback. When both exist, compare `updated_at` timestamps — newest wins as the authoritative source.

**Dual-write:** During transition, `/checkpoint` writes BOTH formats. Once all skills reference the ledger, checkpoint.md can be deprecated.

**`.gitignore` note:** Add `.claude/session-ledger.yaml` to `.gitignore` — it contains session-local state, not project history.

## Save Checkpoint

### 1. Auto-Detect
Scan for: `task_plan.md`, `progress.md`, `findings.md`, `.claude/plans/*`

### 2. Gather State
Run: `git status`, `git log --oneline -5`, `git branch --show-current`, `git rev-parse HEAD`

### 3. Concurrency Guard
Before writing, check if `.claude/session-ledger.yaml` already exists:
- Read existing `session_id` and `updated_at`
- If `session_id` differs from current session AND `updated_at` is less than 5 minutes ago: **warn the user** that another session may be active. Do not overwrite without explicit confirmation.
- If `session_id` matches or `updated_at` is >5 min old: safe to write.

### 4. Write `.claude/session-ledger.yaml`

```yaml
schema_version: 1
session_id: "[unique session identifier]"
updated_at: "2026-04-16T14:30:00Z"  # ISO 8601
status: "in-progress"  # or "finalized"
source: "ledger"

git_baseline:
  branch: "feature/example"
  commit: "abc1234"
  commit_message: "last commit message"

task_summary: "1-2 sentences: what and why"

decisions:
  - decision: "Chose X over Y"
    reasoning: "Because Z constraint requires it"
  - decision: "Used library A instead of B"
    reasoning: "A has native support for our use case"

files_modified:
  - path: "src/handler.ts"
    symbols: ["handleRequest", "validateInput"]
    diff_summary: "Added retry logic to handleRequest, new validateInput function"
  - path: "tests/handler.test.ts"
    symbols: ["describe:handleRequest"]
    diff_summary: "Added 3 test cases for retry behavior"

symbol_index:
  "src/handler.ts": ["handleRequest", "validateInput", "ResponseType"]
  "tests/handler.test.ts": ["describe:handleRequest"]

remaining_work:
  - "Write error boundary for edge case in validateInput"
  - "Run full test suite and fix failures"

vna: "Write error boundary for empty payload in src/handler.ts:validateInput"

context_to_reread:
  - "src/handler.ts"
  - "task_plan.md"

time_estimate: "1 hour"
```

### 5. Write `.claude/checkpoint.md` (dual-write)

```markdown
# Checkpoint
**Saved**: [timestamp] | **Branch**: [branch] | **Commit**: [hash] [message]

## Task Summary
[1-2 sentences: what and why]

## Top 3 Decisions (would cause rework if disagreed with)
1. [decision + reasoning]
2. [decision + reasoning]
3. [decision + reasoning]

## Current State
- Modified: [list] | Staged: [list] | Tests: passing/failing/not run
- Planning files present: [list]

## Remaining Work
- [ ] [step 1]
- [ ] [step 2]

## VNA (Very Next Action)
[Single concrete action — not "continue X" but "write handler for Y in Z"]

## Context to Re-Read
- [file paths]

## Time Estimate
[15 min / 1 hour / 2+ hours]
```

### 6. Finalize on Session End
When saving as end-of-session checkpoint, set `status: "finalized"` in the ledger.

## Resume Checkpoint

1. Check for `.claude/session-ledger.yaml` first, then `.claude/checkpoint.md` as fallback
2. **Staleness check**: If ledger `updated_at` is >24 hours old, flag as stale — require re-verification of git state and file contents before trusting any claims
3. Verify git state matches ledger `git_baseline` (branch, commit)
4. If diverged: warn, show what changed since checkpoint, ask user which state to trust
5. Re-read files from `context_to_reread`, focusing on symbols from `symbol_index`
6. Report: "Resuming from checkpoint: [summary]. VNA: [action]."

## Flags

### `--force-fresh`
Bypass ledger entirely. Delete existing `.claude/session-ledger.yaml` and regenerate from scratch by scanning git state, planning files, and project structure. Use when ledger is corrupt, stale beyond recovery, or after major branch changes.

## When to Save

- End of session (always offer)
- Before switching branches/projects
- After major milestones
- When tokens approach 250K

## Anti-Patterns

- Checkpoints without VNA (future session must re-analyze everything)
- Vague remaining work ("finish the feature" vs. specific steps)
- Not listing decisions (causes silent rework)
- Ignoring concurrency guard (overwrites active session's state)
- Trusting stale ledger (>24h) without re-verification
