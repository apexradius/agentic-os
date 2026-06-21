# Cross-Review

Verification in a multi-agent system is done by a **different** agent than the one who built
the work. The burden of proof is on the implementer; the reviewer is a skeptical lead engineer
looking for the failure, not confirming the success.

## What a reviewer fixes — and what it doesn't

A cross-review repairs **plan-deviation, correctness, security, and failing acceptance
criteria**. It does **not** touch style or taste — rewriting working code to personal
preference is how review turns into an endless loop. If the work passes acceptance and has no
defect, it ships.

## The round cap

Review is bounded so it can't ping-pong forever:

- Completion routes the task to `review-pending`; a different member reviews.
- Defects found → back to the owner; `review_round` increments.
- **Exceeding the cap (2 rounds) escalates to the human tiebreaker** instead of continuing.
  Two honest rounds that don't converge mean the disagreement is real, not mechanical.

## Read-only lanes

Some roles must *never* mutate — an analyst or auditor that *can* edit will, eventually,
"helpfully" change the thing it was meant to assess. Lanes are enforced structurally, not by
politeness: a read-only role declares `disallowedTools: Write, Edit` in its definition (see the
agents primitive, [../primitives/agents/](../primitives/agents/)), so the capability is absent,
not merely discouraged.

During its review round a reviewer may edit the files under review; ownership flips back to the
owner afterward ([ledger.md](ledger.md)).

> Last reviewed: 2026-06-19
