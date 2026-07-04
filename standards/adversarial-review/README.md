# Adversarial Review

This gate validates portable adversarial-review artifacts. It does not decide whether a
human reviewer is right; it proves the artifact is hard to fake:

- every finding carries concrete evidence,
- every finding maps to a checked failure mode,
- a clean pass checks the required six adversarial failure modes, and
- clean-pass coverage carries evidence for those checks.

## Artifact Shape

```json
{
  "id": "review-2026-06-25",
  "checked_failure_modes": [
    "hallucinated-surface",
    "plausible-but-wrong",
    "silent-fallback",
    "scope-drift",
    "fabricated-verification",
    "confident-staleness"
  ],
  "findings": [],
  "clean_pass": true,
  "clean_pass_coverage": [
    {
      "failure_mode": "hallucinated-surface",
      "evidence": {
        "type": "command",
        "command": "rg -n \"claimed-symbol\" framework",
        "observed": "No matches for the claimed symbol"
      }
    }
  ]
}
```

For non-clean reviews, `findings` must be evidence-backed:

```json
{
  "failure_mode": "fabricated-verification",
  "severity": "P1",
  "summary": "The closeout claims validation passed but no validation output is attached.",
  "evidence": {
    "type": "artifact",
    "ref": "reports/closeout.json",
    "observed": "The claim has no command, tool call, or observed output"
  }
}
```

## Run

```bash
node framework/standards/adversarial-review/validate.mjs
node framework/standards/adversarial-review/validate.mjs path/to/review.json
```
