---
skill: ai-video
eval-type: rubric
---
# Eval: ai-video (rubric)

Video output is graded, not binary — score against the rubric; ship only above threshold.

## Task
> "Make a 15s social video introducing a productivity app — hook in the first 3 seconds,
> vertical format, upbeat."

## Rubric
| # | Criterion | Weight | Pass condition |
|---|---|---|---|
| 1 ★ | Prompt adherence | 3 | Subject, length, and format match the brief (≈15s, vertical) |
| 2 ★ | Hook | 2 | A clear attention hook lands within the first ~3 seconds |
| 3 | Shot coherence | 2 | Continuity holds across cuts; no jarring identity/scene drift |
| 4 | Pacing/structure | 2 | Follows a deliberate structure (e.g. 10-80-10), not a flat clip |
| 5 | Spec fit | 1 | Aspect ratio, duration, and any captions fit the target platform |

Total: 10 points.

## Pass threshold
≥ 8 of 10. A ★ criterion scoring 0 (off-brief, or no early hook) fails regardless of total.
