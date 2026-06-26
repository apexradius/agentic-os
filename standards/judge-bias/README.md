# judge-bias

The standards-as-code gate for model-judged verification. It enforces the doctrine that a
judge is only acceptable after deterministic grading is exhausted, and that any remaining
judge path declares controls for known judge bias.

## What it checks

Any `judge-gate.json` manifest under `framework/standards/` must declare:

- deterministic-first routing
- order-swap judging
- required agreement across swapped presentations
- judge separation policy
- rubric controls for verbosity and self-preference

The gate is intentionally structural. It does not call a model and does not decide whether a
judge verdict is correct; it proves the bias controls are present before a judge is trusted.

## Verify

```bash
node framework/standards/judge-bias/validate.mjs
node framework/primitives/_lib/validate.mjs --all
```

> Last reviewed: 2026-06-26
