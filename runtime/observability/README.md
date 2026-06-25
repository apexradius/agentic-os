# observability — the run-record sink

The engine half of the [observability standard](../../doctrine/standards/observability.md): an
append-only **run-record** for every closed task, so "is the framework actually making agents better?"
is answerable from numbers instead of anecdote. The standard owns the *fields*
([`runrecord.schema.json`](runrecord.schema.json)); the instance owns the *store* (the log path).

Zero dependencies, no clock of its own: [`lib/record.mjs`](lib/record.mjs) is a pure builder +
redactor, so the selftest pins time and the record is fully deterministic; [`sink.mjs`](sink.mjs)
supplies the real clock and the real file. It mirrors [`../scheduler/`](../scheduler/) and the
opt-in / fail-open / redacted shape of [`standards/tool-gate/lib/audit.mjs`](../../standards/tool-gate/lib/audit.mjs).

It is **not** wired into `validate.mjs --all` (that discovers `standards/` + `primitives/` only) — it is
engine code; run its selftest directly or alongside the scheduler's in CI.

## The contract

- **Opt-in.** Writes only when `RUNRECORD_LOG` points at a file; otherwise `appendRunRecord` is a no-op.
  The path is instance-supplied — the framework hardcodes none.
- **Fail-open.** A write error is swallowed (returns `null`); observability must never wedge the task it observes.
- **Redacted.** `gate_decisions` keep only `{decision, rules, reason_hash}` — never the raw reason, command,
  or path (a sha256/12 of the reason correlates identical reasons and reveals nothing), per
  [`data-handling`](../../doctrine/standards/data-handling.md).
- **Append-only NDJSON.** One JSON object per line; readers group by `task_id` when correlating a task's runs.

## Run it

```bash
# Append a run-record when a task closes (from your close-task path), opt-in via the env var:
RUNRECORD_LOG=/abs/path/runs.ndjson node your-close-task-script.mjs

# Read the trail back:
node framework/runtime/observability/sink.mjs /abs/path/runs.ndjson --failed
node framework/runtime/observability/sink.mjs /abs/path/runs.ndjson --task T-123 --since 2026-06-25
```

The [eval-harness](../../standards/eval-harness/) scoreboard is the first writer: with `RUNRECORD_LOG`
set, each gradeable eval result lands here.

## Verify

```bash
node framework/runtime/observability/validate.mjs   # pinned-time selftest: ts injection, redaction, opt-in, append-only, fail-open
```

> Last reviewed: 2026-06-25
