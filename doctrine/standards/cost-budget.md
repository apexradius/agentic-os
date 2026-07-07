# Cost Budget Standard

Bounding cumulative spend per run without ever stranding work in flight. The spend-side sibling of
the [context budget standard](context-budget.md): that one keeps the living handoff fresh as the
window fills; this one caps how many tokens a run may consume and warns before it does.

The executable standard lives at [`framework/standards/cost-budget/`](../../standards/cost-budget/);
its `validate.mjs` is the proof. This document is the law it enforces.

## Why cumulative, not a snapshot

The context budget reads the transcript's **last** assistant `message.usage` — a snapshot of how
full the window is right now, which resets on compaction. Cost is the opposite reduction of the same
data: the **sum** of every assistant message's usage, monotonic, never resetting. Same file, same
field, different fold. A gate that measured only the current window could never see a run that
compacted ten times and burned a fortune doing it.

The sum must **dedup by `message.id`, last-wins**. One API message occupies several transcript
lines that share a `message.id` while `output_tokens` grows; a naive per-line sum over-counts
(measured 2–3× on real sessions), because the constant per-line `input_tokens` is added once per
line. This is the same dedup key the span emitter uses. A meter that ignores it trips the ceiling
long before the run has actually spent the budget.

## What "cost" means when you are subscription-only

There is no per-token bill, so "cost" resolves to two distinct things and they must not be conflated:

- **Tokens are enforced.** Total processed tokens (`input + cache_read + cache_creation + output`)
  is real, measurable live from the transcript, and is the enforcement dimension.
- **Dollars are reported, never enforced.** The `$` figure is an estimate at published list prices —
  "what would this have cost." It must be derived **per category**: `cache_read` bills at roughly a
  tenth of the input rate, so a single-bucket `$` is an order-of-magnitude lie, and a lying cost
  report is worse than none. The price map is instance configuration; the framework ships no prices.
  Because the central span layer collapses the three input categories into one `tokens_in`, the `$`
  estimate is derived from the transcript, which preserves the split — not from the spans table.

## Never hard-stop the session; deny expansion, not completion

Halting mid-mutation is worse than overspending. The hard tier therefore denies **only expansion** —
new sub-agent dispatch and configured expensive tools — and leaves the entire finish-and-verify path
(reads, edits, shell, commit, the handoff) open. An over-budget run must always be able to land its
current unit and hand off cleanly; what it may not do is start new expensive work. The deny is a
narrow, positively-scoped set, never a blanket block. Like the context guard's top rung, no tier ever
bricks the session.

The hard tier does not release. You cannot un-spend tokens, so once the ceiling is crossed the gate
holds until the session ends or the budget is raised — but since completion is never denied, holding
is safe.

## The meter is O(new bytes)

Re-summing the whole transcript on every tool call adds latency to every call on a session whose
transcript only grows. The meter keeps a running sum plus a byte-offset watermark in a per-session
sidecar and folds only the delta window each call, rewinding to the start of the still-growing tail
message so it is committed once at its final value. A shrunk, rotated, or missing state triggers one
full rescan and a rewrite. A guardrail that is expensive to consult is a guardrail that gets removed.

## Budget declaration and scope

Enforcement scope is per-session — that is what the in-hook transcript sum can measure. Per-agent and
per-task accounting are reporting roll-ups off the central spans table, not in-hook gates.

The ceiling is resolved by a ladder: a per-session sidecar value first (the seam an orchestration
layer writes a per-node budget into), then an environment default, then none — and none means
unbounded, which means inert. Declaring a budget is opt-in; the absence of one is never an error.

## Fail-open

A broken budget gate must never silently block real work. It denies only on a positively-measured
`used ≥ a positively-declared ceiling`; absent either signal it is inert. Any error, unknown event,
missing session, unreadable transcript, or absent budget yields no decision. The gate is a guardrail
on honest runaway, not a security boundary — a shell tool in the allow set can still re-invoke a
model, and that is an accepted, documented limit, not a hole to be plugged with a broader block.
