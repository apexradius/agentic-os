# Durability

The loop survives **context** loss through WHISK and compaction recovery ([context.md](context.md)).
It survives **process** loss — a crash, a kill, a host reboot mid-run — through this: a journal it
appends to as it goes, and a replay rule it reads on restart so an interrupted run resumes without
re-firing a side effect it already completed.

Without it, a killed unattended run (a one-shot dispatch, an overnight batch) loses in-flight state
and can re-fire side effects — a duplicate email, a repeated deploy, a doubled write. WHISK and
rollback-on-verify-failure do not cover this: the first survives a shrinking token window, the
second reverts a *bad* slice. Neither prevents a *good* slice from running **twice** because the
process died between doing the work and recording that it was done.

## The three parts

**1. A journal — the append-only step record.** As the loop runs a task, it appends one record per
step boundary to a durable log: when a step *starts*, and when it finishes *ok* / *fail*. One JSON
object per line, latest-matching wins. The schema is
[`../runtime/durability/journal.schema.json`](../runtime/durability/journal.schema.json); the
writer/reader is [`../runtime/durability/journal.mjs`](../runtime/durability/journal.mjs). Like the
[observability sink](../runtime/observability/), it is **opt-in** (writes only when the instance
configures a log path — the framework hardcodes none) and **fail-open** (a journal error never
wedges the step it protects). The store, the path, and what counts as a "step" are instance-owned.

**2. A replay rule — skip what's already done.** On restart, before running a side-effecting step,
the loop asks the journal: *has this exact step already completed ok?* If yes, it **skips
execution and reuses the recorded result**. A bare `start` with no matching `ok` is *not* a
hit — it marks a step that was interrupted, so it must run again. This is `replayLookup()`: the
latest entry for `(task_id, step, idempotency_key)` whose result is `ok`/`pass`, or nothing.

**3. An idempotency key — make re-execution a no-op.** Every side-effecting step carries a
deterministic key: `hash(task_id + step + salient_inputs)` — the same inputs always produce the
same key, different inputs never collide. The key is what the replay rule matches on, and what a
downstream system (a mailer, a deploy target, a writer) can dedupe against so that even a re-run
that slips past replay lands **exactly once**. A step with no stable key cannot be made
exactly-once; give every side-effecting step one.

## Where it composes with the rest of the loop

- It rides on the **same idempotency invariant** the bounded convergent loop already requires
  ([verification.md](verification.md) → idempotency): a step the loop may re-run must land the same
  state whether it runs once or twice. Durability is that invariant extended from *reiteration*
  (re-run within a live process) to *replay* (re-run after the process died).
- It pairs with the scheduler's **resumable claim** ([../coordination/scheduler.md](../coordination/scheduler.md)):
  a task claimed (not closed) when the process died is re-selected on the next tick by its owner;
  the journal is what makes that re-selection skip the work already done instead of repeating it.
- The journal is a **replay log, not an audit log** — it records what a restart needs to resume.
  It carries pointers to proof (a result-file path, an exit code), **never the raw payload**, per
  [data-handling](../doctrine/standards/data-handling.md). The observability run-record
  ([standards/observability](../doctrine/standards/observability.md)) answers "is the framework
  improving?"; the journal answers "what did this run already finish?". Different jobs.

## Runtime-agnostic by construction

This is a **convention plus a schema**, not a vendor runtime. Durable-execution products (Temporal,
DBOS, Inngest, Restate) implement this same journal-and-replay shape; the framework encodes the
shape so any instance gets crash-durability without coupling to one of them. An instance is free to
back the journal with a file, a table, or one of those runtimes — the loop only needs append, read,
and the replay rule.

> Last reviewed: 2026-06-25
