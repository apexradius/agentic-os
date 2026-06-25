---
skill: mock-rubric
eval-type: rubric
---
# Eval: mock-rubric (rubric)

A fixture rubric eval — proves weighted scoring, ★ auto-fail rows, and the pass threshold. Each
row's *Pass condition* carries a machine predicate so the selftest grades it with no model judgment.

## Task
> Generate a product hero shot for a matte-black water bottle — neutral background, copy space on the right.

## Rubric
| # | Criterion | Weight | Pass condition |
|---|---|---|---|
| 1 ★ | Subject on-brief | 3 | contains:"matte-black bottle" |
| 2 | Composition | 2 | contains:"copy space" |
| 3 | Functional color | 2 | contains:"neutral background" |
| 4 ★ | No artifacts | 2 | not_contains:"warped" |
| 5 | Output spec | 1 | contains:"3:2" |

Total: 10 points.

## Pass threshold
≥ 8 of 10. A ★ criterion scoring 0 fails the eval regardless of total.
