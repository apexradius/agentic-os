---
skill: mock-fail
---
# Eval: mock-fail

A fixture baseline eval the mock RED output fails — proves the scoreboard records a regression so
the gate can catch one.

## Baseline
Prompt without the skill: the agent wraps the handler in try/catch, returns a 200, and calls it done.

## Pass
With the skill, the response names the ROOT CAUSE before any fix and introduces no error-swallowing.

```expect
contains: ROOT CAUSE
not_contains: try/catch
```
