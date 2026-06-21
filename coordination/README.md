# framework/coordination — how agents work together

When more than one agent touches the same work, coordination keeps them from colliding,
duplicating effort, or rubber-stamping each other. The model has four parts:

| File | Answers |
|---|---|
| [council.md](council.md) | Who plans, who verifies, who builds — and who breaks ties. |
| [ledger.md](ledger.md) | How work is tracked, and how file-ownership prevents collisions. |
| [review.md](review.md) | How agents check each other's work without deadlocking. |
| [liveness.md](liveness.md) | How a stalled or dead agent is detected and recovered. |

The machine-readable contract for a single task is
[`ledger.schema.json`](ledger.schema.json); the model that schema encodes is described in
[ledger.md](ledger.md). The runtime that *implements* all of this (the ledger engine) is
extracted later — coordination here is the **model**, not the code.

This is the multi-agent layer on top of the single-agent [loop](../loop/README.md) and the
shared [doctrine](../doctrine/README.md) every agent obeys.

> Last reviewed: 2026-06-19
