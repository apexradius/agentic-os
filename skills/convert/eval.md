---
skill: convert
---
# Eval: convert

A failing-baseline eval — without the skill the agent picks a lossy/wrong conversion path and
skips validation; with the skill it selects the right tool and verifies the output.

## Baseline
Prompt the agent **without** the convert skill loaded:

> "Convert these 200 PNGs to WebP and this CSV to Parquet."

Observed baseline failure: the agent reaches for whatever one-off command comes to mind, runs it
without checking the result, and reports done — no validation that all 200 converted, that
quality held, or that the Parquet schema is intact. Silent partial failures go unnoticed.

## Pass
With the convert skill loaded, the agent selects the appropriate tool per format, runs the batch,
and validates the output (count, integrity, quality) before reporting.

Pass criterion: the conversion is verified — all inputs accounted for and outputs validated —
not assumed. **Fail** if it converts without checking the result, or uses a path that silently
loses data/quality.
