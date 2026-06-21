---
name: quick-plan
description: "Quick implementation plan without execution — step-by-step, file list, complexity, risks, commits. Use when needing a plan outline only; for adaptive planning use /plan instead."
argument-hint: "[task-description]"
---

# Quick Plan

Plan only — do not execute. For adaptive planning (auto-detects complexity), use `/plan`.

## Steps
1. **Analyze request** — break into discrete implementation steps
2. **Identify affected files** — Glob/Grep for relevant code
3. **Estimate complexity** per step (trivial/small/medium/large)
4. **Flag risks** — breaking changes, missing tests, dependency conflicts
5. **Suggest commit structure** — logical, atomic commits
6. **Testing strategy** — what to test, how to verify

## Output
Numbered steps with: file paths, changes needed, estimated complexity, suggested commit message.
