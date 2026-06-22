---
skill: ai-image
eval-type: rubric
---
# Eval: ai-image (rubric)

Image output is graded, not binary — score the result against the rubric; ship only above
threshold.

## Task
> "Generate a product hero shot for a matte-black water bottle for an e-commerce page —
> studio lighting, neutral background, space for a headline on the right."

## Rubric
| # | Criterion | Weight | Pass condition |
|---|---|---|---|
| 1 ★ | Subject on-brief | 3 | The depicted object is the requested product, not a near-miss |
| 2 | Composition | 2 | Follows the requested framing (negative space on the right for copy) |
| 3 | Functional color | 2 | Palette matches the stated mood/brand; not a random default look |
| 4 ★ | No artifacts | 2 | No garbled text, warped geometry, or melted edges on the focal object |
| 5 | Output spec | 1 | Correct aspect ratio and resolution for the stated placement |

Total: 10 points.

## Pass threshold
≥ 8 of 10. A ★ criterion scoring 0 fails the eval regardless of total (wrong subject or visible
artifacts is an automatic fail).
