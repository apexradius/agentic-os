# The Scheduler

Reactive agents wait to be asked. The agents Hermes Agent and OpenClaw popularized are
**proactive**: a built-in heartbeat wakes them on a cadence (OpenClaw ~every 30 min), they
check for pending work, and they run what is due — no human prompt required. This is the model
for making the Council proactive **over the ledger it already keeps**, not a second store.

## The tick

The scheduler runs one **tick** on a cadence. A tick is read-only and pure: it reads the
append-only [`tasks.jsonl`](ledger.md), then selects the tasks that are all three of:

1. **Ready** — every id in `depends_on` is `completed` (no half-built dependency chains run).
2. **Unstarted or mine** — `status` is `pending`, or `claimed` by the owner running the tick
   (so a tick re-drives its own in-flight work but never steals another agent's claim).
3. **Due** — `due_at` (if set) has passed, and for a recurring task the `schedule` interval has
   elapsed since `metadata.last_run_at`.

The selected tasks are returned **ordered by priority then id** — a deterministic dispatch plan.
The tick **dispatches nothing itself**: emitting the plan is the portable, side-effect-free
core. Handing the plan to the executor/Council, claiming the task, and stamping `last_run_at`
are instance actions, because they mutate live state and must flow through the ledger engine's
claim path (file-ownership, liveness) — see [`ledger.md`](ledger.md) and [`liveness.md`](liveness.md).

## Cadence fields

Two optional ledger fields ([`ledger.schema.json`](ledger.schema.json)) drive timing:

| Field | Shape | Meaning |
|---|---|---|
| `due_at` | RFC 3339 timestamp | Earliest time a **one-shot** task may dispatch. Absent = dispatch as soon as ready. |
| `schedule` | interval expr (`@every 30m`, `@every 1h`, `@every 90s`) | A **recurring** task re-dispatches each time the interval elapses since its last run. |

`schedule` is the **portable heartbeat form** deliberately, not full cron: an interval is enough
to express "drain the inbox every 30 minutes" or "post the nightly report," it parses with zero
dependencies, and it fails *safe* (an unparseable cadence never auto-dispatches). Full cron
expressions, calendar windows, and the actual wakeup timer are the **instance's** job — it wires
the tick to its platform scheduler (cron, a launch agent, a `CronCreate` job) at whatever cadence
it chooses. The framework supplies the selection logic; the instance supplies the clock.

## Why it lives where it does

The selection logic is **machinery**, so it lives in
[`framework/runtime/scheduler/`](../runtime/scheduler/) (`tick.mjs` + a pure `lib/select.mjs`),
zone-pure and dependency-free, beside the `ledger/` and `council/` engines. This file is the
**model** (doctrine); the cadence and wiring are **instance state**. Doctrine is law, knowledge
is state, code is machinery — never mixed.

> Last reviewed: 2026-06-25
