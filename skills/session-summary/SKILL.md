---
name: session-summary
description: "Summarize the current session — what was done, what changed, what's pending. Save to memory for future reference. Use when wrapping up a session, saving progress, or /session-summary."
user-invocable: true
disable-model-invocation: true
---

# Session Summary

## Compile
1. **Files changed** — `!git diff --stat` or list edits from this conversation
2. **Features/fixes** — what was accomplished
3. **Decisions made** — architectural choices, trade-offs
4. **Pending items** — what's left to do
5. **Blockers** — anything discovered that needs resolution

## Save to memory
Write a project memory summarizing key decisions and context that would be useful in future sessions.

## Output
Concise markdown report with sections: Accomplished, Pending, Decisions, Blockers.
