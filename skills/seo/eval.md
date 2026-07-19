---
skill: seo
---
# Eval: seo

A failing-baseline eval — without the skill the agent gives generic "add keywords, write good content,
get backlinks" advice; with it, the agent diagnoses the actual constraint, checks winnability, and returns
a ranked, cited plan that separates classic SEO from AI-search.

## Baseline
Prompt the agent **without** the seo skill loaded:

> "Our new plumbing company's service page isn't ranking for 'emergency plumber [city]' and we get no
> leads from Google Maps. What do we do?"

Observed baseline failure: the agent says "do keyword research, write more content, build backlinks,
improve page speed, ask for reviews" — no intent/SERP read, no difficulty/winnability check, no
indexation triage, generic GBP advice with no review-velocity or category specifics, conflates AI search
with classic SEO, and cites nothing. Indistinguishable from a listicle.

## Pass
With the seo skill loaded, the agent:
- **Reads the live SERP + intent** and checks winnability (DR+10 / lowest-DR-in-top-5) before promising a rank.
- **Clears indexation blockers first** (noindex/robots/JS render) rather than jumping to content.
- Prescribes **topical authority + answer-first E-E-A-T content**, not keyword stuffing; consolidates duplicates.
- Gives **specific Local/GBP** actions: most-specific primary category, review milestone (10) + velocity (≥1/wk) + quality (4.7–4.9), keywords in customer review text, NAP consistency, real service-area pages (no city-swap templates).
- Treats **AI search as a distinct workstream** (QAE, entities, branded mentions) with the ~19%-crossover caveat.
- Returns a **ranked, cited plan** (highest-leverage first) and frames numbers as source claims.

## Rubric (score each 0-2; pass ≥ 12/16)
1. Intent/SERP-format match checked before targeting.
2. Winnability (DR+10 / difficulty) assessed, not just volume.
3. Indexation/technical blockers triaged first.
4. Content plan = topical authority + answer-first + real E-E-A-T (not density/stuffing).
5. Local/GBP specifics: primary category, review velocity+quality+customer-text keywords, NAP, service-area pages.
6. AI-search handled as its own workstream (QAE + entities + branded mentions).
7. No penalty-risk tactics (PBN links, review gating/batching, city-swap templates).
8. Ranked plan, cited to `src`, numbers framed as source claims.

**Fail** if the output is generic "research keywords / write content / get links" with no winnability
check, no indexation triage, and no citations — i.e. indistinguishable from the no-skill baseline.
