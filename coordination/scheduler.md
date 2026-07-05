# The Scheduler

> **Optional pattern — not the default loop.** The scheduler drives a proactive loop over the
> optional shared control-plane ledger ([ledger.md](ledger.md)); it presupposes that store.
> File-based coordination does not require it.

Reactive agents wait to be asked. The agents Hermes Agent and OpenClaw popularized are
**proactive**: a built-in heartbeat wakes them on a cadence (OpenClaw ~every 30 min), they
check for pending work, and they run what is due — no human prompt required. This is the model
for making the loop proactive **over the ledger it already keeps**, not a second store.

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
core. Handing the plan to the executor, claiming the task, and stamping `last_run_at`
are instance actions, because they mutate live state and must flow through the ledger engine's
claim path (file-ownership, liveness) — see [`ledger.md`](ledger.md) and [`liveness.md`](liveness.md).

## The proactive loop (wiring the tick)

The tick selects; it does not act. An instance turns it into a **proactive agent** by wrapping it
in a loop that the cadence fires. The portable shape — each step already has a home in this
framework, so the loop is wiring, not new machinery:

1. **Single-instance guard.** Take a lockfile (PID + liveness check) so two ticks never overlap
   ([liveness.md](liveness.md)). A stale lock whose holder is dead is reclaimed.
2. **Tick.** Run the read-only tick → the ordered dispatch plan.
3. **Bound the batch.** Take as many tasks as the instance allows per tick (one is the safe
   default — it bounds a crash's blast radius to a single task).
4. **Risk floor.** Skip any task whose `risk_level` is `high`/`critical` — those route to the
   operator, never to autonomous dispatch ([review.md](review.md)).
5. **Claim.** Move the task to `claimed` with the owner stamp, through the ledger engine's claim
   path so file-ownership and liveness hold ([ledger.md](ledger.md)).
6. **Replay check.** Before any side-effecting step, ask the durability journal whether this exact
   step already completed; if so, skip it and reuse the recorded result
   ([../loop/durability.md](../loop/durability.md)).
7. **Dispatch.** Hand the task to the executor (a one-shot is the simplest faithful form: a fresh
   bounded context that pulls layered memory, does the work, exits). Journal the step.
8. **Verify.** Run the task's deterministic check ([../loop/verification.md](../loop/verification.md)).
   A machine check decides done — not the executor's own say-so.
9. **Bounded reiterate.** On verify-failure, re-dispatch carrying the failure evidence, up to the
   loop's ceiling *N*. Each iteration must change the failing input.
10. **Close or escalate.** Pass → record verification + complete + stamp `last_run_at` (the
    recurrence anchor). Ceiling hit → escalate with the "tried *N* times" evidence and stop.
11. **Release + exit.** Drop the lock and exit; the cadence re-invokes next interval.

Every step here is an **instance action** because each mutates live state — which is exactly why
the tick itself stays pure and stops at step 2. The framework supplies the selection logic, the
ledger engine, the journal, and the verify loop; the instance supplies the clock and the executor.

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
zone-pure and dependency-free, beside the runtime's `durability/` and `observability/` engines. This file is the
**model** (doctrine); the cadence and wiring are **instance state**. Doctrine is law, knowledge
is state, code is machinery — never mixed.

> Last reviewed: 2026-06-25
