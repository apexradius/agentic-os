# Verify

The phase that turns "I changed the code" into "I watched it work." Skipping it is the deepest
behavioral drift — it converts an operator back into a coder.

## Definition of done

**Code-shipped is not done. Verified-working is done.** After any production change, do not
write a completion message in the same turn until you have:

1. **Triggered** the changed path with a real input.
2. **Observed** the output — logs, response body, a DB row, a side effect, a mailbox.
3. **Confirmed** the observed output matches the intended behavior.

If verification surfaces a bug, fix it in the same turn. Do not return "shipped, want me to
verify?" — that phrase *is* the failure mode. If you genuinely cannot verify this turn (it
needs a real user action or an external SLA wait), state plainly what you could not verify and
why — as a fact, not a question.

"Done" means an **executable check passed and you watched it pass** — not "I reviewed the
output." Code → run the tests. Deploy → hit the health check. Generation → validate the format.

**Prefer a deterministic grader; reserve a judge for what only a judge can grade.** Classify each
acceptance criterion: if a rule can decide it — a unit test, a schema or format validator, an
exact match, a tool-call or decision match — that rule *is* the gate, and a model-graded "judge"
is forbidden there. A judge is slower, costlier, and biased by answer order and verbosity, so a
judge rubber-stamping what a test could have decided is verification theater. Reserve model
judgment for genuinely free-form output where no rule suffices — and justify it when you do.

## The pre-ship gate

Before any code goes to production — every time, no exceptions:

- [ ] Lint passes (zero errors/warnings on touched files)
- [ ] Tests pass for the affected paths
- [ ] No hardcoded secrets
- [ ] No injection surface (no SQL string-concat, no `innerHTML` of untrusted data, auth
      checks on protected routes). Any doubt about injection, auth, or secrets → surface it
      before shipping.
- [ ] Backward compatibility verified — or the breaking change is intentional and communicated
- [ ] A rollback plan exists
- [ ] The end-to-end path was triggered with real input and the output matched intent

If any item fails, **do not ship — fix first.**

## Apply the AI-failure-mode lens — even solo

The pre-ship checklist catches what's *missing*; this lens catches what's plausibly *wrong*.
Agent-produced work fails in characteristic ways that are invisible to its own author, so the
verifier must probe them deliberately — and a cross-reviewer is not always there. In solo
operation you run the lens against your own work; the two modes most lethal at *this* phase:

- **Fabricated verification** — "tests pass" / "done" with no command actually run, or a test
  that asserts nothing (tautology, mocked to green). This phase exists for the *observed* result;
  a completion claim without one is not done, it is `[unverified]`.
- **Silent fallback** — a `try/catch` or a default that turned a failure into quiet-but-wrong
  behavior, making the path *look* green. Trigger the error path, not just the happy one.

The full catalog — hallucinated surface, plausible-but-wrong, scope drift, confident staleness,
with how to probe each — is the single-sourced table in
[the cross-review lens](../coordination/review.md). A solo runtime applies that lens to its own
output before declaring done; a multi-agent one gets it twice — self here, then a different
reviewer in [cross-review](../coordination/review.md).

## Rollback on verify failure

When verification fails, don't patch the patch in a recursive fix loop. Revert to the last
checkpoint, re-read the plan / `WIRING.md`, and re-implement from the corrected understanding.
Revert the *code* — but keep the *failure evidence* in working context (the WHISK carve-out in
[context.md](context.md)): the stack trace that just failed is what steers the re-implementation
away from the same wall.

## The bounded convergent loop

Verify is a loop, not a gate you pass once. A failed check sends the work back to Implement under
the *same* plan — that re-entry is **reiteration**, and it is the normal path, not an error. Three
things keep reiteration from running away:

- **Convergence.** Every step the loop may re-run must be **idempotent** — running it twice lands
  the same state as running it once
  ([../doctrine/rules/idempotency.md](../doctrine/rules/idempotency.md)). A non-idempotent retry
  doesn't fix the failure, it doubles it.
- **A ceiling.** The implement→verify cycle carries an explicit budget: a default cap of *N* failed
  iterations on the same slice (the instance sets *N*; three is a sane default), plus any token or
  wall-clock ceiling the instance imposes. Each iteration must change the input that caused the
  failure — re-running an identical attempt and expecting a different result is exactly the waste
  the cap exists to kill. **Watch the trend, not just the count.** A *converging* loop shrinks its
  failure surface each pass — fewer failing checks, a smaller diff, the error moving rather than
  repeating. A loop whose failure surface is flat across two passes has hit a *ceiling*, not a
  *speed-bump*: escalate then, without spending the rest of the budget to prove what the flat trend
  already shows. The count is the hard cap; the trend is the early one — and a flatlined trend is
  the more honest stop signal, because it distinguishes "one more pass will land it" from "stuck on
  the same wall."
- **A stop.** When the ceiling is hit, the loop **stops and escalates** instead of burning the rest
  of the window. Escalation is one mechanism at two scales: a solo runtime halts and asks
  ([../doctrine/rules/decision-making.md](../doctrine/rules/decision-making.md)); a multi-agent
  runtime hands to the Council tiebreaker or a human
  ([../coordination/council.md](../coordination/council.md)). Stopping with a clear "tried *N* times,
  here is the wall — and the failure stopped shrinking after pass two" beats a silent infinite grind.

## Close-out: retire the plan, keep the knowledge

A plan is scaffolding, not a record. Once the work is verified done, the plan has served its
purpose — and a plan left on disk rots into a stale to-do that reads as open work it isn't. So
the **last act of Verify is to close the plan out**:

1. **Fold the outcome into the knowledge base** — what was actioned, the deciding evidence (the
   commit, the artifact, the verified behavior), and any decision worth citing later. Knowledge
   is the standing record; the plan was the disposable means to it.
2. **Note any remainder in the task ledger** — work the plan opened but didn't finish (gated on a
   decision, a later phase, an external wait). The ledger ([../coordination/](../coordination/))
   is where open work survives a context reset — not a plan file.
3. **Delete the plan.** Once 1 and 2 hold, the file is redundant. A plans dir that holds only
   genuinely-open plans stays trustworthy; one full of finished plans does not.

Partially-done is the common case, not the exception: fold what shipped into knowledge, move
what's left to the ledger, delete the plan. "Keep it for reference" is not a reason to retain a
plan — that reference is exactly what step 1 moved into knowledge. This is a **discipline, not a
gate**: a plan's completion isn't deterministically detectable from the file, so no validator
enforces it — the loop does.

> Last reviewed: 2026-06-25
