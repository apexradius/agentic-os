# scheduler

The proactive-loop machinery: one read-only **tick** over a coordination ledger that selects the
tasks ready and due to dispatch. It is the engine half of
[`framework/coordination/scheduler.md`](../../coordination/scheduler.md) (the model half) — the
heartbeat both Hermes Agent and OpenClaw ship, expressed over Apex's existing append-only
`tasks.jsonl` instead of a bespoke store.

Zero dependencies, no clock of its own: `lib/select.mjs` is a pure function of
`(records, now, owner)`, so the selftest pins time and the selection is fully deterministic.
`tick.mjs` supplies the real clock and the real ledger file.

## Run it

```bash
# Print the dispatch plan for a ledger (read-only — safe on a live tasks.jsonl):
node framework/runtime/scheduler/tick.mjs path/to/tasks.jsonl

# Scope to one owner (re-drive my own claimed work, ignore others'):
node …/tick.mjs --owner claude --json path/to/tasks.jsonl
```

A task is dispatched when it is **ready** (all `depends_on` completed), **unstarted or mine**
(`pending`, or `claimed` by `--owner`), and **due** (`due_at` passed / `schedule` interval
elapsed since `metadata.last_run_at`). Output is ordered by priority then id. The tick
**dispatches nothing** — claiming, running, and stamping `last_run_at` are instance actions that
must flow through the ledger engine's claim path; see the model doc.

## Wiring (instance)

The instance points its platform scheduler at the tick at whatever cadence it wants:

```cron
*/30 * * * *  node /path/to/framework/runtime/scheduler/tick.mjs --owner <role> /path/to/tasks.jsonl | <hand plan to executor>
```

The framework supplies the selection logic; the instance supplies the clock and the dispatch.

## Verify

```bash
node framework/runtime/scheduler/validate.mjs   # 22 checks: interval parse, isDue, the 4 core selection behaviors, owner scoping
```

> Last reviewed: 2026-06-25
