# Liveness

A claimed task whose owner has died is worse than an unclaimed one: it looks like progress
while nothing happens. Liveness detection finds and recovers stalled work.

## Heartbeat

A working agent periodically stamps its task: `last_heartbeat_at` (plus host/pid). A heartbeat
that stops advancing means the owner is gone or stuck. Claims also record `claimed_by_host` and
`claimed_by_pid`, so a claim can be tested against a live process.

## What a watchdog detects

A periodic sweep flags tasks that are stuck, by state:

| Signal | Meaning |
|---|---|
| **stale pending** | Unclaimed past its threshold — nobody picked it up. |
| **stale claimed** | Claimed but the heartbeat went quiet — owner stalled. |
| **dead claim** | The claiming process is no longer alive — safe to release and re-queue. |
| **stale review** | A `review-pending` task nobody reviewed in time. |
| **dependency deadlock** | A cycle in `depends_on`, or all owners blocked on each other. |

## Recovery

A detected stall is **released, not silently dropped**: a dead claim returns the task to
`pending` (freeing its `files_owned` lock) so another agent can take it; a deadlock or a
repeatedly-stale task escalates to the human tiebreaker. The thresholds and the alert channel
are instance-specific; the *model* — heartbeat, sweep, release-or-escalate — is the generic
contract here.

> Last reviewed: 2026-06-19
