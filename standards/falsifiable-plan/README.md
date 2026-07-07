# falsifiable-plan

The executable check for serialized plan envelopes. A plan is falsifiable when every
load-bearing assertion declares what kind of unknown it is:

- `discoverable` assertions carry the probe that would disprove them.
- `preference` assertions point to the decision-gate ask that will ratify them.

The gate checks shape only. It does not decide whether a probe is strong enough, whether a
decision should have been asked, or whether the plan is strategically good.

## What it checks

The validator accepts a JSON object with:

- `kind: "plan"`, non-empty `id`, and non-empty `objective`
- non-empty `assertions[]`
- each assertion has non-empty `claim` and `class`
- `class` is exactly `discoverable` or `preference`
- discoverable assertions have a non-empty `probe`
- verified discoverable assertions have `evidence.ref` shaped like a persisted path
- status, when present, is `pending` or `verified`
- preference assertions have non-empty `decision_id`
- preferences cannot be `verified` by the planner
- non-empty `acceptance[]`, each with `criterion` and `check`

## Verify

```bash
node framework/standards/falsifiable-plan/validate.mjs
node framework/standards/falsifiable-plan/validate.mjs framework/standards/falsifiable-plan/example-plan.json
node framework/primitives/_lib/validate.mjs --all
```

> Last reviewed: 2026-07-07
