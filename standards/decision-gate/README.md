# decision-gate

Executable enforcement for the **decision-ask**: the single, batched question an orchestrator
puts to the operator when several preferences are genuinely unresolved. The gate checks the ask
is well-shaped before it is sent.

The classification law it serves — is an unknown **discoverable** (find it, never ask) or a
**preference** (ask once) — lives in
[`framework/doctrine/rules/decision-making.md`](../../doctrine/rules/decision-making.md), whose
"Batch preferences into one structured ask" section defines the batched form this gate checks.

## Run it

```bash
node framework/standards/decision-gate/validate.mjs
node framework/standards/decision-gate/validate.mjs path/to/decision-ask.json
node framework/primitives/_lib/validate.mjs --all
```

`example-decision-ask.json` is a conforming three-fork ask you can validate as a starting point.

## What it checks

- `kind` is `"decision-ask"`.
- `decisions` is a non-empty array of **at most four** items — one batched ask, not a drip.
- Each decision has a non-empty `question`.
- Each decision has **2–4 unique, non-empty `options`** — never a single forced choice.
- Each decision has a `recommendation` that is **one of its options** (the marked recommendation).
- `id`, when present on a decision, is unique across the ask.
- F36: any `resolution` or `resolved` field must cite an operator basis (`operator`,
  `operator-turn`, `operator-answer`) or `precedent:<decision-id>`; self-ratification
  in the same run is decision laundering.

## The decision-ask shape

```json
{
  "kind": "decision-ask",
  "decisions": [
    {
      "id": "D1",
      "question": "Which store backs the session cache?",
      "options": ["Redis", "in-memory", "Postgres"],
      "recommendation": "Redis",
      "rationale": "shared across nodes, native TTL"
    }
  ]
}
```

`rationale` is optional; everything else above is required.

## Resolution discipline

An unresolved ask has no `resolution` field. If a runtime records a resolution, F36
requires a basis outside the asking agent's own turn: `operator`, `operator-turn`,
`operator-answer`, or `precedent:<decision-id>`. `task-directive`, `self`, `derived`,
and an absent basis are self-ratification, so the gate rejects them.

## What it does not check

This gate enforces the ask's **shape**; whether a question should have been asked at all — a
discoverable fact must never appear in an ask — is scored **behaviorally** by the
[trajectory-eval standard](../trajectory-eval/) (`question_economy` gates the run to a single
paused-to-user stop; `question_discoverability` judges whether the stop was truly undiscoverable).
A static gate cannot tell a discoverable question from a preference one — that is judgment, not
shape — so this standard does not pretend to. The two layers compose: the shape here, the
behavior there.

## Symmetry with worker-brief

A decision-ask is the operator-facing counterpart to a worker brief
([`framework/primitives/worker-brief/`](../../primitives/worker-brief/)): a **brief goes down** to
a cold worker, an **ask goes up** to the operator. Both carry a declared, checkable shape so the
orchestrator's two conversations — with its workers and with its operator — are each disciplined.
