---
skill: competitor-scan
---
# Eval: competitor-scan

A failing-baseline eval — without the skill the agent writes a vague impression of a competitor;
with the skill it returns a structured teardown with an actionable gap list.

## Baseline
Prompt the agent **without** the competitor-scan skill loaded:

> "Size up this competitor for us." (a competitor's marketing site URL)

Observed baseline failure: the agent writes a paragraph of generalities ("they seem
established, clean branding, broad offering"). No tech stack, no meta/schema strategy, no
pricing, no structured comparison, nothing we can act on.

## Pass
With the competitor-scan skill loaded, the agent analyzes the competitor across dimensions —
tech stack, meta strategy, schema, content, pricing, ads/social — and surfaces value gaps.

Pass criterion: the output is a structured scan with per-dimension findings and an explicit list
of gaps/opportunities versus us. **Fail** if it returns prose impressions without the dimensional
breakdown and gap list.
