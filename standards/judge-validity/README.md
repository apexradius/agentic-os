# judge-validity

The standards-as-code gate for validating model-judge agreement against a committed gold set.
Raw agreement is not enough: when labels are imbalanced, two raters can agree often by chance.
This gate computes Cohen's kappa and requires the configured minimum.

## What it checks

Any `judge-validity-gold.json` manifest under `framework/standards/` must carry paired labels:

- `ratings_a`
- `ratings_b`
- `min_kappa`

The gate computes Cohen's kappa over the paired labels and fails the manifest if agreement is
below the threshold.

## Verify

```bash
node framework/standards/judge-validity/validate.mjs
node framework/primitives/_lib/validate.mjs --all
```

> Last reviewed: 2026-06-26
