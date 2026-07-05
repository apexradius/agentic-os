# The Ledger

> **Optional pattern — not the default loop.** The default coordination model is file-based: a
> shared plan/progress doc with explicit file ownership ([README.md](README.md)). This document
> describes a richer **shared control-plane ledger** a consumer *may* adopt when a fleet outgrows
> file-based coordination. The **file-ownership discipline** below is generic and underpins both
> models; the `tasks.jsonl` store and its lifecycle fields are specific to this optional pattern.

The coordination ledger is a **file-backed control plane**: plain append-only records, no
database — greppable, diffable, and surviving any process dying. It answers three questions at
all times: what work exists, who owns it, and what each task is waiting on.

## Shape

- **`tasks.jsonl`** — the shared task ledger: one JSON object per line, each conforming to
  [`ledger.schema.json`](ledger.schema.json). Append-only; the latest line for an id wins.
- **`inbox/<role>.jsonl`** — per-role message queues (handoffs, review requests, escalations).
- A **roles** registry — the agents in play and their lanes.

## The task record

The full field set is in [`ledger.schema.json`](ledger.schema.json). The load-bearing fields:

| Field | Why it exists |
|---|---|
| `id`, `title`, `status` | Identity and lifecycle state — the minimum a task needs. |
| `owner` | Who currently holds it (null = unclaimed). |
| `files_owned` | The paths this task write-locks while claimed — the collision guard (below). |
| `depends_on` | Task ids that must finish first; a cycle is a deadlock to detect. |
| `acceptance_criteria`, `verification_command` | The objective bar + the machine check for it. |
| `review_required`, `review_round` | Whether it routes to cross-review, and the ping-pong count. |
| `risk_level` | `high`/`critical` auto-escalate to the operator. |
| `claimed_by_*`, `last_heartbeat_*` | Liveness — is the owner still alive? (See [liveness.md](liveness.md).) |

## File ownership prevents collisions

The rule that makes parallel agents safe: **before writing, an agent claims the files it will
touch in `files_owned`. One task owns a given file at a time.** Another agent that needs the
same file waits, or the work is re-sliced. This is the multi-agent extension of the
single-turn rule "no parallel edits to the same file"
([../doctrine/rules/anti-patterns.md](../doctrine/rules/anti-patterns.md)).

A cross-reviewer is the one allowed exception: it may edit the files under review during its
round, after which ownership flips back ([review.md](review.md)).

**Section-level ownership for shared artifacts.** A few files are *meant* to carry many hands over
their life — a shared plan/progress doc, a long-lived knowledge file, the prose companion to this
ledger. Write-locking the whole path serializes contributors that never touch the same lines. For
these, ownership may be claimed at **section** granularity: a task owns named, disjoint sections
(e.g. `plan.md#progress`) rather than the whole path, and two tasks may hold different sections of
one file at once. Two floors keep it safe: (1) the sections must be **genuinely disjoint, and one
declared role is the sole mutator of structure** — adding, removing, or reordering sections — so two
agents never both restructure the file out from under each other; (2) it changes the *ownership
unit*, not the laws of physics — concurrent byte-level writes to one file still corrupt, so section
edits still serialize through the ledger (each in its own turn), they are never simultaneous.
Default to whole-file ownership; reach for sections only when a shared artifact is provably a
contention point.

## The audit trace

State tells you *what* a task is now; it doesn't tell you *why* it got there. An optional
`transitions` array on the record carries that — one append-only entry per lifecycle change (`at`,
`by`, `from_status`, `to_status`, `rationale`, and an optional `evidence` pointer). It is the
portable form of a signed review note: an escalated or cancelled task stays greppable for its
current state *and* legible for the decision behind it. The trace is append-within-record, so the
latest-line-wins rule still decides current state — `transitions` records the path, not the
position.

> Last reviewed: 2026-06-25
