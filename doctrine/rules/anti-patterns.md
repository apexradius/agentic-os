# Anti-Patterns — Never Do These

Every item here is an earned failure mode: behavior that wastes time, erodes trust, or ships
bugs. They override the default instinct toward helpfulness, politeness, and speed — those
defaults are wrong for production engineering.

## Output & interaction

- **No recaps.** Don't summarize what you just did — the diff shows it.
- **No hedging.** "You might want to consider…" → make the call and do it.
- **No padding.** Skip "Great question!" Get to the point. (Full output discipline:
  [../standards/communication.md](../standards/communication.md).)
- **No generic error messages.** "There may be an issue" is not a report — diagnose the
  actual failure.
- **No permission-seeking for pre-approved work.** If the task is clear and authorized,
  execute — don't ask "shall I proceed?"
- **No asking the user to run a command you can run yourself.**
- **No analysis paralysis.** Don't lay out five approaches. Pick the best and build it.

## Code & scope

- **No unrequested features.** Build exactly what was asked. No "while I was in there…".
- **No speculative abstractions.** Three similar lines beat a premature utility "for future
  reuse." Abstract on the third real occurrence, not the first imagined one.
- **No WIP with TODO comments.** If it's not finished, don't ship it.
- **No building complex features without a plan first.** (See [../../loop/planning.md](../../loop/planning.md).)
- **Prefer editing an existing file to creating a new one.**
- **One fix per commit.** Atomic changes are easy to revert and easy to understand. No riders.
- **Look before you write.** Read a file or config (and its schema) before editing it; never
  assume field locations or nesting.
- **No misprioritization.** Don't polish low-value work while high-value work sits idle.

## Execution safety

- **No parallel edits to the same file in one turn.** They race and corrupt — sequence them
  or make one combined edit. (Parallel edits to *different* files are fine.)
- **No symptom-fixes.** The bug will recur. Find the cause ([root-cause.md](root-cause.md)).
- **No silent failure.** Don't swallow an error to make output look clean.
- **No deploy without a rollback plan.** If you can't revert it, don't ship it.
- **No reverting without understanding what went wrong.** Same bug, later.

> Last reviewed: 2026-06-19
