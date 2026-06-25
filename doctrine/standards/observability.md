# Observability Standard

The framework's deepest claim is that it makes agents *better* — more reliable, more correct over
time. That claim is only honest if it's measurable. Today the
[coordination ledger](../../coordination/ledger.md) records what a task *is* and who owns it, but
nothing about how the run *went*: how long it took, how many attempts it cost, what it spent, whether
Verify passed the first time. Without that, "is the framework working?" can only be answered by
anecdote. This standard makes the framework's own behaviour queryable.

## The run-record

Every closed task appends one structured **run-record** to an instance-owned, append-only sink (a
gitignored log file, a table — the instance picks the store; the *fields* are the standard). At
minimum:

| Field | Captures |
|---|---|
| `task_id`, `slice` | Which work this run was. |
| `model`, `effort` | What tier executed it. |
| `duration`, `attempts` | Wall-clock, and how many implement→verify iterations it took. |
| `tokens` / `cost` | What the run spent. |
| `verify` | First-pass pass/fail, and the result at close. |
| `gate_decisions` | What the gates allowed, asked, or denied along the way. |

The run-record obeys the [data-handling standard](data-handling.md): it records *that* a gate denied a
call, never the secret-bearing payload it denied. The [tool-gate](../../standards/tool-gate/) ships a
concrete instance of exactly this — an opt-in, append-only, redacted log of every allow/ask/deny — as
the `gate_decisions` stream that feeds this record.

## What it unlocks

A measurable system improves on evidence instead of argument:

- **Drift detection** — a skill whose pass-rate is sliding, a gate whose ask-rate is climbing, surfaces
  in the numbers before it surfaces as a failure.
- **The eval scoreboard gets somewhere to write.** An executable eval suite is only useful if its
  results land in a queryable place; the run-record is that place.
- **The learning loop becomes data-driven** — "which gates catch the most real failures, which rules
  get skipped under pressure" becomes answerable, so doctrine evolves from accumulated outcomes rather
  than from the last thing someone happened to remember. The [learning standard](learning.md) defines that
  loop; [`framework/runtime/learning/`](../../runtime/learning/) reads these records to surface its signals.

This standard defines the *contract* — the fields, and the append-only, redacted shape. The sink and
the readers now exist: [`framework/runtime/observability/`](../../runtime/observability/) builds and
stores the record (opt-in, fail-open, redacted), and [`framework/standards/eval-harness/`](../../standards/eval-harness/)
is its first writer — its scoreboard lands one run-record per gradeable eval. The point is that nothing
closes a task without leaving a trace of how the run actually went.

> Last reviewed: 2026-06-25
