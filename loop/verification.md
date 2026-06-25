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

## Rollback on verify failure

When verification fails, don't patch the patch in a recursive fix loop. Revert to the last
checkpoint, re-read the plan / `WIRING.md`, and re-implement from the corrected understanding.
Revert the *code* — but keep the *failure evidence* in working context (the WHISK carve-out in
[context.md](context.md)): the stack trace that just failed is what steers the re-implementation
away from the same wall.

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

> Last reviewed: 2026-06-24
