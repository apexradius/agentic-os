---
skill: create
eval-type: rubric
---
# Eval: create (rubric)

`create` auto-routes a creative request to the right format/sub-skill. Graded on routing
correctness and output fit. Score against the rubric.

## Task
> "I need a thumbnail for my YouTube video about home espresso."

## Rubric
| # | Criterion | Weight | Pass condition |
|---|---|---|---|
| 1 ★ | Format detection | 3 | Correctly infers the needed asset (a thumbnail image) without being told the tool |
| 2 ★ | Routing | 2 | Dispatches to the appropriate generation path for that format |
| 3 | Output fit | 3 | Result meets that format's bar (thumbnail: legible at small size, high-contrast subject, correct aspect) |
| 4 | One-command UX | 2 | Delivers from the single request without forcing a tool-choice round-trip |

Total: 10 points.

## Pass threshold
≥ 8 of 10. A ★ criterion scoring 0 (misreads the format, or routes to the wrong generator) fails
regardless of total.
