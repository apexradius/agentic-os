# Plan

Planning is not optional, and it is not in your head — it's on disk, before you execute.

## The planning mandate (scales with size)

| Task size | What you write, before any code |
|---|---|
| < 5 steps | A quick mental outline — then execute |
| 5–15 steps | A `plan.md` — the approach + the steps |
| 15+ steps / architecture decisions | A full spec — requirements + design + tasks |

For any task with **3+ distinct actions, the first tool call writes the plan to disk** — not
after some exploration, first. This turns the mandate from a remembered intention into a
structural gate: you cannot start executing a multi-step task until the plan exists as a file.
(Where artifacts live: [artifacts.md](artifacts.md).)

## Decision-complete plans

A plan resolves **every fork**. "Decision complete," not "a list of steps." If an implementer
— or a future you, post-compaction — would have to make a judgment call the plan didn't make,
the plan isn't finished. Name the files to change, the approach for each, and the existing code
to reuse. Don't leave choices to discover mid-build.

Resolve unknowns the right way *before* writing the plan: discoverable facts get found,
preferences get one round of questions. (See
[../doctrine/rules/decision-making.md](../doctrine/rules/decision-making.md).)

## Evidence-driven hypothesis ranking

When the work is diagnostic — a bug, a regression, an unknown cause — the plan is a ranked set
of hypotheses, not a single guess:

1. List the candidate causes.
2. For each, the **evidence for and against** it.
3. Rank by likelihood; test the top one first; record what each probe eliminated.

Track uncertainty explicitly: what would change the ranking, and which probe would tell you.
This is the same discipline the [root-cause law](../doctrine/rules/root-cause.md) requires.

> Last reviewed: 2026-06-19
