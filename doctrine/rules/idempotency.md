# Idempotency

Any operation the loop might run more than once must be safe to run more than once. Agents retry on
ambiguous failures constantly — a timeout, a dropped connection, a failed
[Verify](../../loop/verification.md) that sends the work back through Implement. If the retried step
isn't idempotent, the retry doesn't recover the failure, it compounds it: two rows where there should
be one, a double-charged action, a file appended twice.

## The rule

**Running a step twice must land the same state as running it once.** This is the property that makes
[reiteration and rollback](../../loop/verification.md) safe. A step that lacks it can't be retried,
only feared — and an agent that fears its own retries can't run a convergent loop.

## How to get it

- **Guard before you mutate** — check whether the effect already exists, and no-op if it does.
- **Upsert, don't blind-insert** — key on identity so a re-run updates in place instead of duplicating.
- **`IF NOT EXISTS` / create-or-replace** — let the operation itself absorb the second run.
- **Carry an idempotency key** — when the effect crosses a boundary you don't control, a stable key
  lets the far side dedupe a redelivery instead of doubling it.

## The anti-pattern

Blind retry of a non-idempotent mutation after a timeout. The first attempt may have *succeeded* and
only its acknowledgement was lost — so the retry runs the mutation a second time. "It timed out, so I
ran it again" is how one logical action quietly becomes two. Before retrying any mutation, either
confirm the first attempt didn't take effect, or make the operation converge so it doesn't matter.

> Last reviewed: 2026-06-24
