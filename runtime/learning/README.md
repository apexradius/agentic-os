# learning — the run-record analyzer

The reading half of the [learning standard](../../doctrine/standards/learning.md): a zero-dependency
analyzer over the [observability](../observability/) run-record log that turns a window of "how each run
went" into a short list of **review candidates** for a human-run retro.

It is the deliberately non-autonomous end of the loop. The lesson it encodes: an unstructured loop that
reads its own output and rewrites the framework produces junk, because nothing outside it defines "better."
So this module **reads only** — it has no write path, always exits success, and its output is addressed to
a person. Any change it inspires goes through the ordinary Plan → Implement → Verify path.

Like [`../observability/`](../observability/), it is **not** wired into `validate.mjs --all` (that
discovers `standards/` + `primitives/`) — it is engine code; run its selftest directly or in CI. The pure
aggregations live in [`lib/analyze.mjs`](lib/analyze.mjs) (no clock, fully deterministic); the CLI entry
[`analyze.mjs`](analyze.mjs) supplies the file and the clock.

## The signals

| Signal | What it flags |
|---|---|
| recurring failures | A slice whose Verify fails repeatedly — root-cause it, don't re-attempt it. |
| rework hotspots | A slice that routinely needs more than one implement→verify attempt — a planning or spec gap. |
| duration / cost outliers | Runs far above the median — where time and spend actually go. |
| gate skew | A rule that *always allows* (candidate dead weight) or *always denies* (real-risk confirmation, or friction to re-tune). |

Every candidate cites the evidence rows that produced it. A candidate with no evidence is dropped.

## Run it

```bash
# Summarize a run-record log into signals + bounded review candidates:
node framework/runtime/learning/analyze.mjs /abs/path/runs.ndjson
node framework/runtime/learning/analyze.mjs /abs/path/runs.ndjson --json --top 8 --min-fails 3
```

The log is whatever `RUNRECORD_LOG` points the [observability sink](../observability/) at.

## Verify

```bash
node framework/runtime/learning/validate.mjs   # pinned-time selftest: aggregation, outliers, gate skew, bounded candidates, read-only guardrail
```

> Last reviewed: 2026-06-25
