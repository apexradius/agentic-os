---
skill: mock-baseline
---
# Eval: mock-baseline

A fixture baseline eval — proves the harness grades a passing run deterministically.

## Baseline
Prompt the agent **without** the skill: it patches the symptom and reports it "fixed" without
ever naming why the bug occurred.

## Pass
With the skill loaded, the response names a ROOT CAUSE and greps for the same pattern elsewhere
before proposing a fix.

```expect
contains: ROOT CAUSE
contains: grep
not_contains: TODO
```
