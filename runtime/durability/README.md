# durability — the step journal

The engine half of [`framework/loop/durability.md`](../../loop/durability.md): an append-only
**step journal** + a **replay rule**, so a killed unattended run resumes without re-firing a side
effect it already completed. The doctrine owns the *convention*; this owns the *machinery*; the
instance owns the *store* (the log path).

Zero dependencies, no clock of its own: [`journal.mjs`](journal.mjs) is a pure `buildEntry` +
append/read + `replayLookup`, so the selftest pins time and entry-building is fully deterministic.
It mirrors [`../observability/`](../observability/) and the opt-in / fail-open / append-only shape
of [`../observability/sink.mjs`](../observability/sink.mjs). The step record schema is
[`journal.schema.json`](journal.schema.json).

Like the observability sink, it is **not** wired into `validate.mjs --all` (that discovers
`standards/` + `primitives/` only) — it is engine code; run its selftest directly or alongside the
scheduler's in CI.

## The contract

- **Opt-in.** Writes only when a journal path is configured (`DURABILITY_JOURNAL`, or an explicit
  `logPath`); otherwise `appendJournalEntry` is a no-op. The path is instance-supplied — the
  framework hardcodes none.
- **Fail-open.** A write error is swallowed (returns `null`); durability must never wedge the step
  it protects.
- **Replay-keyed.** A step is replay-eligible only when a journaled entry for its
  `(task_id, step, idempotency_key)` has result `ok`/`pass`. A bare `start` (interrupted) is **not**
  a hit — it must re-run. The idempotency key is `hash(task_id + step + salient_inputs)`.
- **Pointer, not payload.** `evidence` holds a result-file path / exit code / log location — never
  the raw payload, per [data-handling](../../doctrine/standards/data-handling.md).
- **Append-only NDJSON.** One JSON object per line; the latest matching entry wins.

## Run it

```bash
# Journal a step as the loop runs it (opt-in via the path flag):
node framework/runtime/durability/journal.mjs --append --file /abs/journal.ndjson \
  --task T-123 --step dispatch --attempt 1 --key "$(printf '%s' T-123:1 | shasum -a 256 | cut -c1-16)" --result ok --evidence /abs/result.md

# On restart, ask whether a step already completed (prints the entry, or nothing → must run):
node framework/runtime/durability/journal.mjs --replay --file /abs/journal.ndjson --task T-123 --step dispatch --key <key>

# Read the trail back:
node framework/runtime/durability/journal.mjs /abs/journal.ndjson --task T-123
```

A proactive cadence daemon is the natural first consumer: it journals each `dispatch`/`verify` step
and, after a crash, replays an already-`ok` dispatch so the re-run is exactly-once. An instance
wires this into the [scheduler loop](../../coordination/scheduler.md) at step 6 (the replay check).

## Verify

```bash
node framework/runtime/durability/validate.mjs   # pinned-time selftest: buildEntry purity, opt-in, fail-open, append+read-back, replay hit/miss, latest-wins
```

> Last reviewed: 2026-06-25
