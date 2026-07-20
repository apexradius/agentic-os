---
skill: copywriting
---
# Eval: copywriting

A failing-baseline eval — without the skill the agent writes generic, feature-listing copy; with
it, the agent produces framework-structured, voice-of-customer-grounded, objection-handling copy
with a single CTA that passes the checklist.

## Baseline
Prompt the agent **without** the copywriting skill loaded:

> "Write the landing-page hero and first two sections for a $27 mini-course that teaches freelance
> designers how to land higher-paying clients."

Observed baseline failure: the agent writes a clever-but-vague headline, lists course features
("6 modules, lifetime access, bonus templates"), stacks multiple CTAs, invents a testimonial, and
never surfaces an objection or grounds a single line in how the customer actually talks. It reads
AI-flat and *shows* the course instead of *selling* the transformation.

## Pass
With the copywriting skill loaded, the agent:
- Names a framework fit for the asset (AIDA-hook hero → PAS/BAB body) before drafting.
- Writes a headline that passes the 5-Second Test using a named §IV formula.
- Sells the transformation/identity; translates each feature to a benefit.
- Grounds language in plausible customer words, or explicitly flags "assumed VOC".
- Surfaces at least one real objection and dissolves it; uses real-time/specific proof (or flags
  proof as placeholder — never fabricates a quote/metric).
- Uses exactly one CTA (plus a bottom repeat on a long page) with ethical urgency only.

## Rubric (score each 0-2; pass ≥ 12/16)
1. Framework named and followed.
2. Headline passes 5-Second Test + uses a named formula.
3. Benefits not features (every feature → benefit).
4. Voice-of-customer language present or assumed-VOC flagged.
5. At least one objection surfaced and dissolved.
6. Proof is real-time/specific or flagged placeholder — never fabricated.
7. Exactly one CTA per asset; ethical urgency only.
8. No AI-tells (patterns-of-three, adjective stacks, clinical polish).

**Fail** if the output lists features with multiple CTAs, invents proof, or reads generic with no
framework — i.e. indistinguishable from the no-skill baseline.

## Results — 2026-07-19 (first execution)
Solvers: claude-sonnet-5 subagents (mirrors production agents); grader: claude-opus-4-8 subagent vs rubric with per-item evidence; spot-checked by session lead.

| Arm | Score | Verdict |
|---|---|---|
| Baseline (no skill) | 7/16 | FAIL — no framework named, feature-led module list, stacked CTAs (2 buttons in 2 sections), recurring patterns-of-three |
| With skill | 15/16 | PASS — 8-section anatomy + BAB named, Contrast Disruption headline formula, assumed-VOC flagged with mining workflow, 4 objections dissolved, single CTA; −1: two residual triplets despite self-claim of none |

Delta +8. Cleanup flagged for next revision: unsourced "$2,000+/mo" cost-of-inaction figure should be hedged, and one "$500" renders as a mojibake glyph in the skill arm's output — cosmetic, but worth a wording guard.
