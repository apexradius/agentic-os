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
to reuse. Don't leave choices to discover mid-build. Name, too, the **recommended model tier and
effort** to execute each slice — the executor should never have to guess which model the work
deserves (see [artifacts.md](artifacts.md)).

Resolve unknowns the right way *before* writing the plan: discoverable facts get found,
preferences get one batched round of questions, each with a marked recommendation. (See
[../doctrine/rules/decision-making.md](../doctrine/rules/decision-making.md); the batched-ask
shape is checked by [../standards/decision-gate/](../standards/decision-gate/).)

## Define success up front

A plan that doesn't say what "done" looks like can't be verified — criteria invented *after* the
build are shaped by whatever got built, which is verification theatre. So before Implement starts,
the plan names its **acceptance criteria**, and for each one the **machine check that decides it**:
a deterministic grader (a test, a schema or format check, an exact match, a tool-call or decision
match) wherever a rule can settle it, and a model-graded judge reserved only for genuinely free-form
output no rule can score. Writing the check next to the criterion is what makes
[Verify](verification.md) a gate rather than an opinion — the criteria are the contract Verify holds
the work to, and the [coordination ledger](../coordination/ledger.md) carries the same
`acceptance_criteria` + `verification_command` pair when the task is shared.

## Falsifiable plans

Every load-bearing plan assertion is tagged by the kind of unknown it contains.
`discoverable` means the plan names the probe that could falsify it — a command, artifact
path, or other check found before asking anyone. `preference` means the plan queues the fork
to the decision gate by id and never self-resolves it.

For standard and complex tiers, a plan may serialize this contract as a JSON plan envelope
validated by [../standards/falsifiable-plan/](../standards/falsifiable-plan/): assertions
declare `discoverable` or `preference`, and acceptance criteria still carry the machine
checks that decide them.

## Evidence-driven hypothesis ranking

When the work is diagnostic — a bug, a regression, an unknown cause — the plan is a ranked set
of hypotheses, not a single guess:

1. List the candidate causes.
2. For each, the **evidence for and against** it.
3. Rank by likelihood; test the top one first; record what each probe eliminated.

Track uncertainty explicitly: what would change the ranking, and which probe would tell you.
This is the same discipline the [root-cause law](../doctrine/rules/root-cause.md) requires.

> Last reviewed: 2026-06-24
