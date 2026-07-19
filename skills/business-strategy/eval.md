---
skill: business-strategy
---
# Eval: business-strategy

A failing-baseline eval — without the skill the agent gives generic "grow the business" advice (do more
marketing, hire people, maybe open a second location, aim for 3:1 LTV:CAC); with it, the agent checks the
model is nailed, isolates the single binding constraint, drives founder extraction toward scale-zero, applies
the margin-floor / CAC-payback / human-adjusted LTV:CAC economics, and focuses on more-of-what-works.

## Baseline
Prompt the agent **without** the business-strategy skill loaded:

> "My service business has plateaued around $40k/month. I'm working 60-hour weeks. Should I open a second
> location or launch a new service to grow? How do I scale?"

Observed baseline failure: the agent recommends "yes, expand — open a second location or add a new service
line, do more marketing to drive leads, hire a team, delegate, and aim for a 3:1 LTV:CAC." Doesn't check
whether the model is nailed; doesn't diagnose the constraint (adds complexity to a possibly supply/founder-
constrained business); flat 3:1 LTV:CAC for a human-delivered service; founder-extraction reduced to "delegate";
no margin floor / CAC-payback; no retention lens.

## Pass
With the business-strategy skill loaded, the agent:
- Separates **scaling from growth** and refuses to scale until the model is **nailed** (unit economics +
  bottleneck cleared) — premature scaling doubles overhead and debt.
- Diagnoses the **single binding constraint** (founder/supply/demand): a 60-hour-week plateau is almost
  certainly **founder** (or supply/talent) — so a new location/service *injects complexity*, the wrong move;
  takes **disproportionate action on that one constraint**.
- Drives **founder extraction** toward **scale-zero** (time study → project/process/person, 80% rule,
  Shadow-Supervise-Support, SOP decision trees) — the 60-hour week is the actual problem.
- Applies real economics: **80% gross-margin floor**, **30-day CAC payback**, and an **LTV:CAC ladder adjusted
  for humans in the loop** (not a flat 3:1), plus the four leverages.
- Enforces **focus** (1-1-1, "more" over "new" — cap one new thing a year) and names **retention as the
  scaling engine** (onboard past day 90) + **brand as the moat**.
- Cites `(BL <id>)`, ships mechanics-not-motivation, flags the service-business/Hormozi skew, frames numbers as
  directional, and defers offer/funnel math to `sales-funnels`.

## Rubric (score each 0-2; pass ≥ 12/16)
1. Scaling-vs-growth distinguished; "is the model nailed?" gate applied before any scale move.
2. Single binding constraint diagnosed (founder/supply/demand); new-location/service correctly flagged as complexity injection.
3. Disproportionate action on the ONE constraint — not a scattershot of expand+market+hire.
4. Founder extraction toward scale-zero (time study, 80% rule, SOP decision trees), addressing the 60-hour week.
5. 80% gross-margin floor + 30-day CAC payback present.
6. Human-in-loop-adjusted LTV:CAC ladder (not a flat 3:1) + the four leverages.
7. Focus (1-1-1 / more-not-new) + retention-as-engine (past-day-90) + brand-as-moat.
8. Cites `(BL <id>)`; skew flagged; numbers directional; org/board/financing/benchmark not fabricated; funnel math deferred.

**Fail** if the output is "open a second location / launch a new service, do more marketing, hire, delegate,
aim for 3:1 LTV:CAC" — i.e. scale-a-plateau-with-complexity, no-constraint-diagnosis, flat-ratio economics,
indistinguishable from the no-skill baseline.
