---
skill: sales-funnels
---
# Eval: sales-funnels

A failing-baseline eval — without the skill the agent designs a generic "features + a price + a demo
button" funnel; with it, the agent produces a framework-structured offer, a CAC-recouping funnel
sequence, and a diagnostic read, every choice cited.

## Baseline
Prompt the agent **without** the sales-funnels skill loaded:

> "Design the funnel and offer for a $2,000 done-for-you LinkedIn-lead-gen service sold to B2B founders."

Observed baseline failure: the agent lists service features, slaps a single price on it, sends cold ad
traffic straight to a checkout/booking page, invents "limited to 5 clients this month" scarcity, and has
no front-end/break-even step, no tiering, no guarantee, no discovery structure, and no funnel math. It
reads like a generic pitch deck — indistinguishable from ungrounded advice.

## Pass
With the sales-funnels skill loaded, the agent:
- Runs the offer through the **Value Equation** and Trim & Stacks it into a Grand Slam Offer (textable razor).
- Sets **three-tier anchoring**, an objection-killing bonus or two, and a plain risk-reversal guarantee.
- Sequences `Lead Magnet → Tripwire (break-even) → Core → Upsell`, and **does not send cold traffic to the core offer** — bridges it.
- States the relevant **funnel math** (Human-Loop LTV:CAC floor for a human-heavy service, a break-even CAC target, and/or the close-rate pricing diagnostic).
- For the sales call, puts **discovery before pitch** with a named framework (CLOSER/Rocket) and a value-added follow-up cadence.
- Uses **internal/genuine scarcity** (never fabricated counts) and **holds price** (Bonus Bank, not discount).
- Cites each framework/number to a `src` and frames numbers as source claims.

## Rubric (score each 0-2; pass ≥ 12/16)
1. Offer run through the Value Equation; textable razor applied.
2. Three-tier anchoring + objection-killing bonus(es) + a risk-reversal guarantee.
3. Funnel sequenced with a break-even front end (not core-offer-to-cold).
4. Correct archetype (VSL/webinar/application) chosen for the price/trust level.
5. Funnel math stated (LTV:CAC floor / break-even target / close-rate diagnostic).
6. Sales-call: discovery-before-pitch with a named framework + value-added follow-up.
7. Scarcity is genuine; price is held (no discount-to-close).
8. Frameworks/numbers cited to `src`; numbers framed as source claims, not verified data.

**Fail** if the output lists features with a single price, sends cold traffic straight to the offer,
invents scarcity, or omits funnel math — i.e. indistinguishable from the no-skill baseline.

## Results — 2026-07-18 (first execution)
Solver: claude-sonnet-5 subagents; grader: session lead vs rubric, per-item evidence.

| Arm | Score | Verdict |
|---|---|---|
| Baseline (no skill) | 7/16 | FAIL — stronger than predicted: strong risk-reversal guarantee, genuine-scarcity warning ("should be *true*"), organic-proof-first traffic. Missed: no Value Equation/named frameworks, no 3-tier anchor or bonus stack, no break-even tripwire, zero funnel math, unnamed call framework, no citations |
| With skill | 16/16 | PASS — Value Equation + Trim & Stack + textable razor; 3-tier anchor + Bonus Bank + guarantee; LM→$97 tripwire (break-even)→core→upsell, cold never sent to core; application-funnel archetype reasoned; 12:1 human-loop LTV:CAC + break-even CAC + close-rate diagnostic; CLOSER + two-for-two + 5-touch value-added follow-up; genuine sender-pool scarcity; `src` cited throughout |

Delta +9. The funnel-math stage is the skill's sharpest edge — baseline had literally zero economics;
treatment independently identified the 12:1 LTV:CAC floor as the binding constraint on the whole offer.
