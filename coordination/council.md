# The Council

A small set of co-equal frontier agents owns **planning and verification** — and only those.
No single member sets direction; direction is a Council output, not one agent's call.

## Plan/verify is the Council; build is separate

- **The Council plans and verifies.** Members co-author the plan and, later, check the work
  against it. They are co-equal: a directive is the Council's, never one member's.
- **Implementation is a separate executor layer.** Any capable agent is dispatched to build
  the planned slice. A Council member may *also* wear the executor hat, but that's a different
  job — routing a build is a capability question, not a Council one.

Keeping these layers distinct is what stops "the planner graded its own homework."

## The loop

1. **Intake** — a task brief enters the [ledger](ledger.md).
2. **Plan** — the Council co-authors a decision-complete plan (see
   [../loop/planning.md](../loop/planning.md)) and names the executor.
3. **Build** — the executor implements the slice end-to-end against the plan. When the work is
   parallelizable, the build may fan out to many workers ([fan-out.md](fan-out.md)).
4. **Verify** — a *different* Council member cross-reviews against the plan ([review.md](review.md)).
5. **Escalate** — unresolved disputes and irreversible/high-risk calls go to the human
   tiebreaker.

## Escalation & tie-break

Because the Council is co-equal, deadlocks need an external resolver. A **single human
tiebreaker** settles member disagreements and approves irreversible or high-risk work.
Cross-review that exceeds its round cap escalates there automatically ([review.md](review.md)).

## The handoff brief

Every plan→build handoff is **decision-complete**: scope, the files to change, the approach
per file, the recommended model tier + effort per slice, acceptance criteria, and the
verification command — enough that the executor makes no judgment calls the plan didn't make. A vague handoff is a planning failure, not an executor
failure.

> Last reviewed: 2026-06-24
