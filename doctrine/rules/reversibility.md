# Reversibility & Blast Radius

Before you act, know how far the action reaches and how hard it is to undo. Reversible actions are
made fast and alone; irreversible ones earn ceremony. This rule names the tiers so every gate — the
[tool-gate](../standards/tool-gate.md), a delegation brief, a `RISKS.md` — classifies "risky" the
same way instead of each inventing its own.

## The deciding question

For any action that changes state, ask: **if this turns out wrong, what does it take to get back?**
The answer puts it in one of three tiers.

| Tier | Undo cost | What it requires |
|---|---|---|
| **Reversible** | A cheap, local undo — revert the commit, restore the file, flip the flag back. | Just do it. No approval, no plan. |
| **Recoverable** | Possible but costly — restore from backup, replay a log, manual cleanup, downtime. | A written rollback plan *before* you act, and a checkpoint to roll back to. |
| **Irreversible** | No clean undo — the data is gone, the message is sent, the money moved. | Human approval, a dry-run first, and a `RISKS.md` ([../../loop/artifacts.md](../../loop/artifacts.md)) naming the blast radius. |

## What lands in the high-blast tiers

Tier isn't about how big the diff is — it's about reach. These shapes are Recoverable-or-worse by
default, whatever the line count:

- **Destructive filesystem ops** — recursive delete, overwrite-in-place of data you didn't create.
- **Schema or data migrations** — a drop, an alter, a backfill: anything that rewrites stored state.
- **Force-pushing a protected branch** — rewriting history other people share.
- **Outbound communication** — mail, messages, a public post: anything that leaves the building and can't be unsent.
- **Global or system-wide installs / config changes** — state outside the project's own tree.
- **Credential rotation or revocation** — can lock you out of the very systems you'd need to recover.

## Why classify at all

Treating a Reversible action as Irreversible is a slow, over-cautious agent that asks permission to
breathe. Treating an Irreversible action as Reversible is unrecoverable loss. Naming the tier up front
is how an agent moves fast on the cheap nine-tenths and slows down on exactly the tenth that can't be
taken back. It also gives the gates a shared vocabulary: a tool call's allow/ask/deny, a task's
`risk_level`, and a plan's `RISKS.md` are all answering this one question at different layers.

> Last reviewed: 2026-06-24
