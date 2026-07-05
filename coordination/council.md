# Roles: plan, build, verify

Multi-agent work splits into three roles. Keeping them distinct — especially keeping the agent
that **verifies** separate from the agent that **built** — is what stops "the planner graded its
own homework."

## Plan/verify is one lane; build is separate

- **The planning lane plans and verifies.** A frontier agent (or a small set of them) authors the
  plan and, later, checks the work against it. By default this is the single cloud/frontier lane —
  no standing quorum is required for a directive to be valid.
- **Implementation is a separate executor layer.** Any capable agent is dispatched to build the
  planned slice. The planner *may* also wear the executor hat, but that is a different job —
  routing a build is a capability question, not a planning one.

The verifier must not be the same agent, in the same pass, that produced the work: the reviewer is
a skeptical lead engineer looking for the failure, not confirming the success ([review.md](review.md)).

## The loop

1. **Intake** — a task brief enters the task store (a shared progress doc by default; see
   [README.md](README.md)).
2. **Plan** — the planning lane authors a decision-complete plan (see
   [../loop/planning.md](../loop/planning.md)) and names the executor.
3. **Build** — the executor implements the slice end-to-end against the plan. When the work is
   parallelizable, the build may fan out to many workers ([fan-out.md](fan-out.md)).
4. **Verify** — the work is checked against the plan by an agent that did not build it
   ([review.md](review.md)).

## On-demand cross-review

For a high-stakes or irreversible decision, verification can be raised to a **cross-review**: the
operator requests a second frontier agent to review the plan or the work. This is **on-demand, not a
standing gate** — it is invoked for the calls that warrant it, not required on every task. The two
agents are peers in that review; neither is a standing approver, and **the operator is the final
arbiter** who resolves any disagreement and signs off irreversible or high-risk work. A cross-review
that exceeds its round cap escalates to the operator ([review.md](review.md)).

## The handoff brief

Every plan→build handoff is **decision-complete**: scope, the files to change, the approach per
file, the recommended model tier + effort per slice, acceptance criteria, and the verification
command — enough that the executor makes no judgment calls the plan didn't make. A vague handoff is
a planning failure, not an executor failure.

## Optional pattern — a standing review council

> **Not part of the default loop.** The default is the single planning lane above, with cross-review
> raised on demand. A consumer running a large fleet *may* instead adopt a standing **review
> council**: a fixed set of co-equal frontier members where every directive is the council's output
> rather than one member's, and every completion is cross-reviewed by a *different* member as a
> mandatory gate. Because such a council is co-equal, deadlocks need an external resolver — a single
> human operator settles member disagreements and approves irreversible work. This is a heavier
> pattern; reach for it only when a single planning lane provably cannot keep up.

> Last reviewed: 2026-06-24
