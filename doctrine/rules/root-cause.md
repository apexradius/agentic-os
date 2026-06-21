# The Root-Cause Iron Law

**No fix without root-cause understanding.** This is not negotiable. A fix that doesn't name
the cause isn't a fix — it's a postponement that returns as a worse bug later.

## The protocol

When a bug, error, or regression appears, run these in order. Don't skip ahead.

1. **Reproduce.** Capture the exact error message and the precise steps that trigger it. A
   bug you can't reproduce is a hypothesis, not a bug.
2. **Analyze.** Read the actual code path. Read the logs. Identify what changed recently —
   most regressions are a recent diff.
3. **Hypothesize.** Write down 2–3 candidate causes, ranked by likelihood, each with the
   evidence that points to it. (Evidence-driven ranking lives in
   [../../loop/planning.md](../../loop/planning.md).)
4. **Test the top hypothesis.** Confirm or eliminate it with a real probe. Eliminated → move
   to the next. Don't fix anything until one is confirmed.
5. **Fix the cause, not the symptom.** The change must address *why* it broke.
6. **Verify, then sweep.** Confirm the fix against the original trigger (the gate is
   [../../loop/verification.md](../../loop/verification.md)), then **grep for the same
   pattern elsewhere** — if it broke here, it likely broke in the sibling you haven't opened.

## Never

- **Never change things at random until it works.** That's not a fix; you've learned nothing,
  and the next failure is invisible.
- **Never wrap an error in try/catch to make it disappear.** Suppressing the signal doesn't
  remove the fault — it removes your ability to see it. (See silent failure in
  [anti-patterns.md](anti-patterns.md).)
- **Never say "it works now" without being able to say why it was broken.** If you can't
  explain the cause, you haven't found it.

> Last reviewed: 2026-06-19
