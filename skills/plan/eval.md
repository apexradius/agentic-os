---
skill: plan
---
# Eval: plan

A failing-baseline eval — without the skill the agent dives into code on a multi-file feature;
with the skill it sizes the work and writes the plan to disk before editing.

## Baseline
Prompt the agent **without** the plan skill loaded:

> "Add OAuth login (Google + GitHub) across the API and the web app." (8+ files, external
> APIs, new state)

Observed baseline failure: the agent immediately opens a file and starts editing, holding the
plan only in its head. Context is lost on the first interruption; steps are missed; no
sequencing or file list exists.

## Pass
With the plan skill loaded, the agent estimates complexity across its dimensions (files,
external calls, state), classifies this as Heavy, and produces a written plan (file list,
sequenced steps, risks) **before** any code edit.

Pass criterion: a plan artifact is written to disk and the complexity tier matches the work
(Heavy / spec-driven here) before implementation starts. **Fail** if the agent edits code
before a plan exists, or under-sizes an 8+-file external-API feature as Light.
