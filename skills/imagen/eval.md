---
skill: imagen
eval-type: rubric
---
# Eval: imagen (rubric)

Low-level image generation — graded on faithful execution of the call, not creative direction
(that's `ai-image`). Score against the rubric.

## Task
> "Generate 4 images, 16:9, of a sunlit modern kitchen; negative prompt: no people, no text."

## Rubric
| # | Criterion | Weight | Pass condition |
|---|---|---|---|
| 1 ★ | Prompt adherence | 3 | Each image depicts the requested subject |
| 2 ★ | Negative prompt respected | 2 | No excluded elements appear (no people, no text) |
| 3 | Output spec | 2 | Correct aspect ratio (16:9) and the requested count (4) returned |
| 4 | No artifacts | 2 | No melted geometry or obvious generation failures |
| 5 | Determinism hooks | 1 | Seed/params surfaced so the result is reproducible |

Total: 10 points.

## Pass threshold
≥ 8 of 10. A ★ criterion scoring 0 (subject wrong, or negative prompt violated) fails regardless
of total.
