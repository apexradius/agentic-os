---
skill: video-compose
eval-type: rubric
---
# Eval: video-compose (rubric)

Video output is graded, not binary — score the result against the rubric; ship only above
threshold.

## Task
> "From a one-line brief, produce a 6-second 1080p product-demo MP4: a screen-capture clip
> plays full-bleed, a title card fades in at 1s for 4s, and background music ducks to 50%.
> It must be deterministic — re-rendering yields a byte-comparable result."

## Rubric
| # | Criterion | Weight | Pass condition |
|---|---|---|---|
| 1 ★ | Right tool | 2 | Routes this deterministic brief to HyperFrames/compose, not ai-video |
| 2 | Valid composition | 2 | Stage has `data-composition-id` + `data-width`/`data-height`; each clip has `data-start`/`data-duration`/`data-track-index` |
| 3 ★ | Determinism | 2 | Timelines paused at 0; no `Date.now`/`Math.random`/network calls in the composition |
| 4 | Render output | 2 | Produces a playable MP4 at the stated duration (±0.1s) and resolution |
| 5 | Verified, not assumed | 1 | Output probed (`ffprobe` / frame check), not declared done on exit-0 |
| 6 | Hygiene | 1 | Rendered MP4 gitignored; no secrets in source |

Total: 10 points.

## Pass threshold
≥ 8 of 10. A ★ criterion scoring 0 fails the eval regardless of total — wrong tool or a
nondeterministic render defeats the skill's entire purpose.
