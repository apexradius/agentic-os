---
skill: aeo-optimize
---
# Eval: aeo-optimize

A failing-baseline eval — without the skill the agent optimizes only for blue-link SEO; with the
skill it structures content to be cited by answer engines.

## Baseline
Prompt the agent **without** the aeo-optimize skill loaded:

> "Make this page rank better in AI answers / AI Overviews."

Observed baseline failure: the agent gives generic SEO advice (keywords, backlinks) and ignores
answer-engine specifics — no extractable answer near the top, no entity signals, no FAQ
structure, no llms.txt. The page stays uncitable by LLMs.

## Pass
With the aeo-optimize skill loaded, the agent restructures for AI citation: a concise extractable
answer up top, entity/evidence signals, FAQ structuring, and llms.txt.

Pass criterion: the content leads with a self-contained extractable answer and adds entity
signals + FAQ + llms.txt guidance aimed at AI citation. **Fail** if it returns generic
keyword/backlink SEO with no answer-engine-specific structure.
