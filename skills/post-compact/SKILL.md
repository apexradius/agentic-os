---
name: post-compact
description: "Context recovery after compaction — restores rules, plans, memory, and active files in priority order. Use for /post-compact or after any context reset."
user-invocable: true
---

# Post-Compact — Context-Sensitive Recovery

Recover working state after compaction. Only load what exists. Report what was recovered. Resume with a clear VNA. Target: full recovery in <5 tool calls.

## Recovery Sequence (strict priority)

### P1: Session Ledger + Rules (always)
1. Read `.claude/session-ledger.yaml` — if it exists, this is the authoritative state source
2. Re-read `CLAUDE.md` (project root + parents)
3. Re-read `MEMORY.md`

### P1a: Ledger Validation
If ledger exists:
- **Staleness check**: If `updated_at` is >24 hours old, flag warning: "Ledger is stale (>24h). Re-verifying state before trusting." Require git state and file content verification before acting on ledger claims.
- **Divergence detection**: Compare ledger `git_baseline.commit` against `git log --oneline -1`. If they differ, the repo has moved since checkpoint. Warn: "Repo advanced past checkpoint: ledger says [commit], HEAD is [commit]. [N] commits diverged." List divergent commits.
- If ledger is fresh and git state matches: trust it fully, skip to symbol-level recovery (P3).

### P1b: Ledger Absent — Fallback
If no ledger exists, fall back to `.claude/checkpoint.md` (read-only). If neither exists, proceed to P2.

### P2: Planning Files (only if they exist)
4. `task_plan.md` — objectives and remaining steps
5. `progress.md` — recent completions (tail -30)
6. `findings.md` — research context
7. `.claude/plans/` — any active plan

### P3: Working State — Symbol-Level Recovery
When ledger provides `files_modified` and `symbol_index`:
- Load ONLY the changed functions/classes listed in `symbol_index`, not entire files
- Use `symbol_index` to jump directly to relevant code sections
- Read modified files at the specific line ranges containing listed symbols
- This replaces the old approach of re-reading entire files

When ledger is absent (fallback mode):
8. `.claude/checkpoint.md` — if saved by `/checkpoint`
9. Currently edited file — check `git status` for modified files (full file reads)

## Context-Sensitive Loading

- Ledger exists and fresh? Use it as primary source, skip P2 unless planning files are referenced in `context_to_reread`
- Ledger exists but stale? Load it with warning, then verify against git state
- Ledger absent, checkpoint exists? Use checkpoint as primary state source
- No ledger, no checkpoint, no planning files? Skip P2/P3, restore rules + check git status
- Only progress.md? Use last entries to determine current state

## Briefing Output (MANDATORY)

```
Source: ledger (fresh) | ledger (stale — re-verified) | checkpoint.md (fallback) | git state (no checkpoint)
Recovered: [what was loaded]
Skipped: [what didn't exist]
Divergence: none | [N commits since checkpoint]
State: [1-sentence summary]
VNA: [single concrete next action]
Tool calls used: [N] / 5 target
```

## VNA Verification

VNA must be: a single concrete action (not "continue X"), verifiable (you can tell when done), and the actual next step. If undeterminable: "VNA: Unable to determine — asking user for direction."

## Anti-Patterns

- Re-reading everything regardless of relevance (wastes tokens)
- Resuming without stating VNA (leads to drift)
- Skipping CLAUDE.md re-read (causes rule amnesia)
- Saying "context recovered" without the structured briefing
- Reading entire files when symbol_index provides specific function/class names
- Trusting a stale ledger (>24h) without re-verification
- Ignoring divergence between ledger git_baseline and current HEAD
