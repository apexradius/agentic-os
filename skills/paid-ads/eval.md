---
skill: paid-ads
---
# Eval: paid-ads

A failing-baseline eval — without the skill the agent gives legacy PPC advice (tight ad groups, manual bids,
"raise budget on winners") and vanity-ROAS thinking; with it, the agent structures for the automation era,
lets creative target, respects learning thresholds, feeds down-funnel first-party data, and chases net
profit.

## Baseline
Prompt the agent **without** the paid-ads skill loaded:

> "Our Meta and Google ads aren't profitable. ROAS is low and CPA keeps climbing. What should we change?"

Observed baseline failure: the agent recommends "tighten your ad groups / single-keyword ad groups, lower
bids, pause high-CPA keywords, narrow your audience to your best interests, test one new creative, and aim
for a higher ROAS." Legacy manual-era playbook, audience-narrowing, single-creative testing, no learning-
phase awareness, no first-party/CAPI measurement, no offer/LTV framing. May actively harm (narrowing +
helicopter edits starve the algorithm).

## Pass
With the paid-ads skill loaded, the agent:
- Structures to the **business** and **consolidates** to pool conversions; flags SKAG sprawl / too many ad sets as the likely starve.
- Goes **broad** and treats **creative as the targeting** (interests are suggestions); prescribes hook-rate tracking + **~20 diverse creatives** rather than one test, and knows near-duplicates raise CPM (Andromeda).
- Checks the **learning-phase thresholds** (Google ~15–30 conv/30d; Meta ~50/week) and stops helicopter-editing; scales in small learning-safe steps.
- Fixes **measurement**: down-funnel conversion map, first-party data / Enhanced Conversions / value-based bidding, **Pixel+CAPI**, and a **view-inclusive attribution window**.
- Uses the **search-term report + negatives + message-match**, and reframes the real problem as **CAC:LTV / net profit** and offer-market-fit, not a ROAS number.
- Cites `[GA/MA#]`, frames numbers as directional, and defers LP/copy/stats to cro/copywriting/ab-test.

## Rubric (score each 0-2; pass ≥ 12/16)
1. Consolidated, business-based structure; SKAG/over-segmentation named as a starve risk.
2. Broad-by-default targeting + creative-as-targeting; ~20 diverse creatives, hook-rate tracked (not one test).
3. Learning-phase thresholds respected; no helicopter edits; small-step learning-safe scaling.
4. Down-funnel measurement plan with first-party/Enhanced Conversions/value-based bidding.
5. Meta Pixel+CAPI redundancy + view-inclusive attribution window (click-only rejected).
6. Search-term report + negative-keyword discipline + message-match congruence.
7. CAC:LTV / net-profit framing and offer-market-fit named over vanity ROAS.
8. Claims cite `[GA/MA#]`; numbers directional; LP/copy/stats deferred to siblings.

**Fail** if the output is "tighten ad groups, narrow audience, lower bids, raise ROAS, test a creative" —
i.e. the legacy manual-era playbook, indistinguishable from the no-skill baseline.

## Results — 2026-07-18 (first execution)
Solver: claude-sonnet-5 subagents; grader: session lead vs rubric, per-item evidence.

| Arm | Score | Verdict |
|---|---|---|
| Baseline (no skill) | 8/16 | FAIL — but materially STRONGER than this eval predicted: it already consolidates, names CAPI dedup + ~50 conv/week, refuses audience-narrowing, checks creative fatigue. Missed: creative-as-targeting (~20 diverse, hook rate), learning-safe scaling discipline, EC/value-based bidding, view-inclusive attribution, net-profit/CAC:LTV reframe, citations |
| With skill | 15/16 | PASS — consolidate-to-business + SKAG starve [GA1]; broad + ~20 creatives + hook rate + Andromeda [MA2]; thresholds + 30-day no-touch + 3%/day scaling; funnel-stage conversion map + first-party/EC/VBB; Pixel+CAPI + EMQ + view-inclusive window; net-profit/offer-fit framing; siblings deferred. Dropped 1 pt: search-term-report workflow + message-match congruence not explicit (negatives only) |

Delta +7. HONEST FINDING: the 2026 frontier baseline has absorbed much of the automation-era playbook —
this eval's "observed baseline failure" paragraph understates current baselines. The skill's real margin
is the discipline layer (creative volume/hook-rate, thresholds, attribution window, profit framing) and
traceability, not the headline concepts. Baseline description should be refreshed at next revision.
