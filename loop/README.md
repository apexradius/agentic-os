# framework/loop — the engineering loop

Every non-trivial task runs the same loop: **Plan → Implement → Verify.** Never skip Plan;
never skip Verify. The rigor scales with size, but the shape never changes.

## PIV

- **[Plan](planning.md)** — decide the approach completely before touching code. Rank
  hypotheses by evidence, resolve every fork, write the plan to a file.
- **Implement** — build the slice the plan describes. One concern at a time.
- **[Verify](verification.md)** — prove it works with an executable check you watched pass.
  "Done" is verified-in-reality, not code-shipped. The last act of Verify is **close-out**: fold
  the outcome into knowledge, move any remainder to the task ledger, then delete the plan.

## Artifact gate (rigor scales with size)

The bigger the change, the more the plan must live on disk — so it survives context loss and a
reviewer can check it. ([Artifact shapes →](artifacts.md))

| Size | Files touched | Required artifacts |
|---|---|---|
| **Trivial** | < 3 | none — execute, then verify |
| **Standard** | 3–10 | `WIRING.md` + `IMPLEMENTATION.md` |
| **Complex** | 10+ | add `RESEARCH.md` |
| **High-risk** | release / migration / deploy / prod data | add `RISKS.md` |

## The files

| File | Phase | Covers |
|---|---|---|
| [planning.md](planning.md) | Plan | Planning mandate, decision-complete plans, evidence-driven ranking |
| [artifacts.md](artifacts.md) | Plan/Implement | The four artifacts + the one artifact-path standard |
| [verification.md](verification.md) | Verify | Definition of done, the pre-ship gate, rollback-on-fail, plan close-out |
| [context.md](context.md) | All | Surviving long sessions: WHISK, compaction recovery, VNA, sub-agent dispatch, the reflexes |

The law these obey is [`../doctrine/`](../doctrine/). How agents hand work to each other is
[`../coordination/`](../coordination/).

> Last reviewed: 2026-06-22
