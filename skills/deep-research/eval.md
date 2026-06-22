---
skill: deep-research
---
# Eval: deep-research

A failing-baseline eval — without the skill the agent states confident claims with no provenance;
with the skill every claim carries a verified source and an evidence level.

## Baseline
Prompt the agent **without** the deep-research skill loaded:

> "What's the current state of regulation X, and how are competitors responding?"

Observed baseline failure: the agent produces a fluent, authoritative answer with no citations,
no distinction between fact and inference, and no signal of confidence. Plausible-sounding,
unverifiable, and likely partly hallucinated.

## Pass
With the deep-research skill loaded, the agent verifies sources, tags each claim with an evidence
level (0–5), and applies a structured lens (Porter's / PESTLE / JTBD) where relevant.

Pass criterion: claims are individually sourced and evidence-graded, with uncertain points
explicitly flagged as low-evidence. **Fail** if any material claim is unsourced or fact and
speculation are presented at the same confidence.
