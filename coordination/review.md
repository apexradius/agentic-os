# Cross-Review

Verification in a multi-agent system is done by a **different** agent than the one who built
the work. The burden of proof is on the implementer; the reviewer is a skeptical lead engineer
looking for the failure, not confirming the success.

This discipline applies whenever a reviewer is a different agent than the builder. For a high-stakes
or irreversible decision, the operator may raise a heavier **second-frontier cross-review**
on-demand ([council.md](council.md)); the same evidence floor, lens, and round cap below govern it,
and the operator is the final arbiter.

## What a reviewer fixes — and what it doesn't

A cross-review repairs **plan-deviation, correctness, security, and failing acceptance
criteria**. It does **not** touch style or taste — rewriting working code to personal
preference is how review turns into an endless loop. If the work passes acceptance and has no
defect, it ships.

## The evidence floor

The burden of proof cuts both ways. A defect the reviewer sends back must carry **evidence** —
a `file:line`, the output of a failing command, a named acceptance criterion it violates, or a
dated external source. A finding the reviewer cannot ground that way is labeled **`[unverified]`**:
it is a *question*, not a defect, and on its own it cannot bounce the work back or block the ship.
This kills the most expensive review failure mode — a confident "this looks wrong" that is really a
half-remembered fact from training, stale by the next release, costing a whole round to disprove.

Two altitude failures produce ungrounded findings, and the evidence floor catches both: *tunnel* —
fixating on one line while the plan-level defect goes unseen; and *fog* — hand-waving at "the
architecture" with nothing specific. Forcing every finding down to a `file:line` or up to a named
criterion drags the reviewer off both — to something checkable.

## The AI-failure-mode lens

The evidence floor governs how a finding is *reported*; this lens governs where to *look*. Work
produced by an agent fails in characteristic ways, and the defining property of those failures is
that they are **invisible to the author** — the same fluency that produced the mistake makes it read
as correct. A reviewer of agent work probes these by default, not only when something looks off,
because "looks off" is exactly the signal these failure modes suppress.

| Failure mode | What it looks like | How the reviewer probes it |
|---|---|---|
| **Hallucinated surface** | A called API, flag, config key, import, or method that reads as plausible but doesn't exist in the version in use. | Check the real signature / docs for the pinned version — not memory. A fluent unfamiliar call is the tell. |
| **Plausible-but-wrong** | Compiles and reads correctly but encodes a subtly wrong assumption — off-by-one, inverted condition, wrong default, wrong unit. | Trace one real input end-to-end. It passes a glance; it fails a trace. |
| **Silent fallback** | A `try/catch` that swallows the error, a default that masks a missing value, a `\|\| {}` that turns a failure into quiet-but-wrong behavior. | Ask what happens on the *error* path. "Made it work" often means "suppressed the signal." |
| **Scope drift** | Edits, abstractions, or "while I was here" changes beyond the task — each unreviewed surface and a revert hazard. | Diff against the stated task. Anything outside it is a separate finding, not a freebie. |
| **Fabricated verification** | "Tests pass" / "verified" with no executed evidence, or a test that asserts nothing (tautology, mocked to green). | Demand the command and its output. A claim of done without an observed result is `[unverified]`. |
| **Confident staleness** | An assertion about an external tool/API/version stated as settled fact from training, especially "X isn't supported." | Cross-check against current docs before accepting. Training is a stale snapshot of a moving target. |

A finding from this lens is still subject to the evidence floor — the lens says *where to look*, the
floor says *how to report it*. "This API may be hallucinated" becomes a defect only once grounded in
the real signature; until then it is an `[unverified]` question. The lens widens the search; it does
not lower the bar.

## The round cap

Review is bounded so it can't ping-pong forever:

- Completion routes the work to review; a different agent reviews.
- Defects found → back to the owner; the round count increments.
- **Exceeding the cap (2 rounds) escalates to the operator** instead of continuing.
  Two honest rounds that don't converge mean the disagreement is real, not mechanical.

## Read-only lanes

Some roles must *never* mutate — an analyst or auditor that *can* edit will, eventually,
"helpfully" change the thing it was meant to assess. Lanes are enforced structurally, not by
politeness: a read-only role declares `disallowedTools: Write, Edit` in its definition (see the
agents primitive, [../primitives/agents/](../primitives/agents/)), so the capability is absent,
not merely discouraged.

During its review round a reviewer may edit the files under review; ownership flips back to the
owner afterward ([ledger.md](ledger.md)).

> Last reviewed: 2026-06-25
