# framework/coordination — how agents work together

When more than one agent touches the same work, coordination keeps them from colliding,
duplicating effort, or rubber-stamping each other.

## The default: file-based coordination

By default, multi-agent work coordinates through **repo-local shared documents** — a plan doc and a
progress doc — with **explicit file ownership**. The rules are deliberately simple:

- **One owner per file at a time.** Before writing, an agent claims the files it will touch. Another
  agent that needs the same file waits, or the work is re-sliced. This is the multi-agent extension
  of the single-turn rule "no parallel edits to the same file"
  ([../doctrine/rules/anti-patterns.md](../doctrine/rules/anti-patterns.md)).
- **Shared-file edits are sequenced, never simultaneous.** For a document meant to carry many hands
  (a shared plan/progress doc), ownership may be claimed at **section** granularity so two agents
  hold disjoint sections at once — but concurrent byte-level writes still corrupt, so edits
  serialize (each in its own turn). The ownership mechanics are detailed in [ledger.md](ledger.md).
- **Plan and verify** are owned by the frontier planning lane; **build** dispatches to a separate
  executor layer; verification is done by an agent that did not build the work ([council.md](council.md)).
- **Cross-review is on-demand** — the operator raises a second frontier review for high-stakes or
  irreversible decisions, and is the final arbiter ([review.md](review.md)).

| File | Answers |
|---|---|
| [council.md](council.md) | Who plans, who verifies, who builds — and how cross-review is raised. |
| [fan-out.md](fan-out.md) | How one orchestrator dispatches many workers and folds the results back. |
| [review.md](review.md) | How agents check each other's work without deadlocking. |
| [orchestration.md](orchestration.md) | The executable loop an orchestrator runs — decompose, fan out, synthesize, gate, sequence, dispatch, verify — and the portable manifest that serializes the DAG. |

## Optional pattern — a shared control-plane ledger

A consumer whose fleet outgrows file-based coordination *may* adopt a richer **shared control-plane
ledger**: a file-backed task store with claim/complete, liveness, and a proactive scheduler. This is
**not the default** — nothing in the default loop depends on it — and each doc below is headed as an
optional pattern.

| File | Answers |
|---|---|
| [ledger.md](ledger.md) | How work is tracked in a shared store, and how file-ownership prevents collisions. |
| [liveness.md](liveness.md) | How a stalled or dead agent is detected and recovered. |
| [scheduler.md](scheduler.md) | How the proactive loop picks the tasks that are ready and due to dispatch. |

The machine-readable contract for a single ledger task is
[`ledger.schema.json`](ledger.schema.json); the model that schema encodes is described in
[ledger.md](ledger.md). The machine-readable contract for a multi-agent DAG is described
in [orchestration.md](orchestration.md) and checked by
[`../standards/orchestration-manifest/`](../standards/orchestration-manifest/). The runtime
that *implements* the optional ledger is extracted separately — coordination here is the **model**,
not the code.

This is the multi-agent layer on top of the single-agent [loop](../loop/README.md) and the
shared [doctrine](../doctrine/README.md) every agent obeys.

> Last reviewed: 2026-06-24
