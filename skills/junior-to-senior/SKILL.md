---
name: junior-to-senior
description: "A deliberate second pass that lifts draft work from junior grade (it runs, it answers the question) to senior grade (edge cases named, invariant asserted, failure class swept, verified). Apply before returning any non-trivial code, answer, or plan, or when the user says 'level this up' / 'make this senior-grade' / 'what would a senior do differently' / 'is this good enough to ship' / 'review my work'. Catches the gap between working and well-made — the gap a junior cannot see because it is invisible from inside the first draft. Or /junior-to-senior."
user-invocable: true
argument-hint: "[the draft, or a path to it]"
metadata:
  source: "Adapted from JuliusBrussee/skills junior-to-senior (MIT)"
---

# Junior to Senior

A first draft that works is a junior deliverable. It clears the bar the task literally stated and
stops. A senior deliverable clears the bar the task *implied* — the empty input, the concurrent
write, the token that expires mid-request — and it does so because the author ran a second pass the
junior skipped. The gap between them is not talent; it is a **review the first draft never got**.

This skill is that review, made explicit and repeatable. The reason it has to be a separate pass is
that the gap is **invisible from inside the draft**: at the moment you finish writing code, the
happy path you just reasoned through feels like the whole problem. The edge case you didn't handle
doesn't announce itself — it's defined precisely by being the thing you weren't thinking about.
Forcing a fixed lens over the finished draft surfaces what fluent first-pass attention structurally
misses.

## When to use this skill

- As the final pass before returning any non-trivial code, plan, design, or analysis.
- The user asks to "level this up," "make it senior-grade," "harden this," or "what would a senior
  do differently."
- You catch yourself about to ship a happy-path-only solution.
- A reviewer (human or agent) bounced work back and you want to clear the whole class before
  re-submitting, not just the one finding.

It is cheap enough to run on anything you're about to call done, and most valuable on the things you
feel *most* finished with — confidence that a draft is complete is exactly the state this pass
exists to challenge.

## The senior lens

Run the draft through these six checks in order. Each names a gap that is characteristic of
junior-grade output and systematically invisible to its author. A check that surfaces nothing is
still worth its cost — confirming the boundary is held is part of the deliverable.

1. **Edge cases & failure modes.** What input breaks this? Empty, null, zero, negative, huge,
   malformed, duplicated, out-of-order, concurrent, expired-mid-operation. The happy path is the
   junior's whole world; the boundary is where senior work lives. Name each one and either handle
   it or state explicitly why it can't occur.

2. **The invariant.** What must stay true for this to be correct? Write it down. Then make it
   *loud*: an assertion, a type, a constraint, a test — so that if the invariant ever breaks, the
   failure is immediate and obvious, not silent corruption discovered three weeks downstream. A
   senior doesn't just satisfy the invariant; they make its violation impossible to miss.

3. **The failure class.** Is this bug or gap one instance of a pattern? If you just fixed a missing
   null check here, the same omission almost certainly lives in sibling code. Grep for it. Fix the
   *class*, and hand over the search that proves none remain. One symptom fixed is junior; the
   class eliminated is senior.

4. **Fit & naming.** Does it read like the code around it — same idioms, same comment density, same
   error style? Do the names reveal intent, or do they need a comment to explain what a better name
   would have said? Resist the inverse failure too: three similar lines beat a premature abstraction
   built for a second caller that doesn't exist yet.

5. **Verification.** Is there an executable check that proves this works — and did you *watch it
   pass*? "Looks right" is junior. "I triggered the path with a real input and observed the output
   match intent" is the floor for senior. If the check doesn't exist, writing it is part of this
   pass; if it exists and you haven't run it, run it now.

6. **The unstated assumption.** What did the request take for granted that is actually wrong, or
   about to be? The senior move is to answer the question behind the question: name the assumption,
   say why it's shaky, and either solve for it or flag it. This is the one check that can change
   what gets built, not just how well — so it goes last, after the draft is otherwise solid, when
   you can see the whole shape.

## How to run the pass

1. State, in one line, what the draft is supposed to do and what "done" means for it.
2. Walk the six checks against the actual draft — not against your memory of it. Re-read the code or
   text; the gap hides in what you *think* is there versus what is.
3. For each finding, **fix it in place** if it's in scope, or record it as a named follow-up if it
   genuinely belongs to separate work (scope discipline is itself senior — don't smuggle a refactor
   into a bug fix).
4. Re-verify after the fixes (check 5 again — a fix can break the path that worked).
5. Report what the pass changed and what it deliberately left, with the reason. A senior hands over
   not just the work but the *map of its edges*: what's covered, what isn't, and why.

## What this is not

- **Not a style rewrite.** Reworking functioning code to personal taste is how a review becomes an
  endless loop. This pass targets correctness, robustness, and the failure class — not preference.
- **Not gold-plating.** The goal is the senior bar for *this* task, not the maximal solution.
  Adding unrequested features or speculative abstraction is its own junior tell — it trades the
  stated problem for a more impressive-looking one. Check 4 guards this directly.
- **Not a substitute for cross-review.** A different reviewer still catches what the author's own
  lens can't. This pass shrinks the surface a reviewer has to cover; it doesn't replace them.

---
*Adapted from [`JuliusBrussee/skills` → `junior-to-senior`](https://github.com/JuliusBrussee/skills) (MIT). The six-check lens is the generic, portable form of the average → senior → prime quality ladder.*
