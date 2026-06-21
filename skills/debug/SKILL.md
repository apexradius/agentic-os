---
name: debug
description: "Systematic debugging — reproduce, analyze, hypothesize, fix, verify, monitor. Quick triage mode for common patterns. No fixes without root cause. Use when debugging, fixing bugs, investigating errors, root cause analysis, quick debug, or /debug."
user-invocable: true
argument-hint: "[error-or-symptom]"
---

# Debug — Root Cause Diagnosis & Fix

Iron Law: **No fixes without understanding root cause.**

## Phase 1: Reproduce
- Get exact error message, stack trace, or symptom description
- Identify trigger: what user action or condition causes it
- Check: is it consistent or intermittent?
- Environment: local/staging/prod? Which browser/OS?

## Phase 2: Analyze
- **Trace execution**: Follow the code path from trigger to failure
- **Recent changes**: `git log --oneline -10` + `git diff HEAD~5` — did a recent change cause it?
- **Logs**: Check error logs, console output, network responses
- **Dependencies**: Any recent package updates? `git diff HEAD~10 package-lock.json`
- **Data**: Is the issue data-dependent? Test with different inputs

## Phase 3: Hypothesize
Form 2-3 ranked hypotheses:
```
H1 (most likely): [cause] — Evidence: [what supports this]
H2: [cause] — Evidence: [what supports this]
H3: [cause] — Evidence: [what supports this]
```
Design minimal test for H1. Confirm or eliminate, then move to H2.

## Phase 4: Fix
- Fix the **root cause**, not the symptom
- Document what caused it and why the fix works (in commit message or inline comment)
- One commit per fix (atomic changes)
- Add a test that would have caught this bug
- Check for similar patterns elsewhere in codebase

## Phase 5: Verify
- Original error no longer occurs
- No regressions (run full test suite)
- Edge cases covered

## Phase 6: Monitor (if production issue)
- Watch logs for 15 min after fix deploys
- Check error rates returning to baseline
- Use `/monitor` or Chrome DevTools for live checks

## Quick Triage (Common Patterns)
For quick triage of known patterns, check these before the full 6-phase workflow:
- **Off-by-one**: loop bounds, array indices, string slicing
- **Null/undefined**: optional chaining, default values, missing return
- **Race condition**: async ordering, shared state, missing await
- **Import errors**: circular dependencies, missing exports, wrong path
- **Type mismatch**: string vs number, missing parse/stringify
- **Stale state**: cached value, outdated closure, missing re-render

If the bug matches a common pattern, fix directly. If not, proceed with Phase 1.

## Anti-Patterns (never do these)
- Changing random things until it works
- Adding try/catch to swallow errors
- Fixing symptoms without understanding cause
- "It works on my machine" without investigating environment diff
- Reverting without understanding what went wrong
