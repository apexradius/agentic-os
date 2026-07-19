---
skill: cro
---
# Eval: cro

A failing-baseline eval — without the skill the agent lists generic "make it prettier / add testimonials /
speed it up" tips; with it, the agent checks intent, diagnoses the leak against a benchmark, measures it
right, and proposes a one-variable test.

## Baseline
Prompt the agent **without** the cro skill loaded:

> "Our product landing page gets decent traffic but only converts at 1%. What should we change?"

Observed baseline failure: the agent rattles off "improve the headline, add social proof, make the CTA
bigger, reduce load time, add urgency" with no baseline-vs-benchmark, no intent/traffic-quality check, no
funnel-leak isolation, no measurement plan, and no single-variable test discipline. Undifferentiated from a
generic listicle — and may "optimize" a page whose real problem is wrong-intent traffic.

## Pass
With the cro skill loaded, the agent:
- **Benchmarks the 1%** against the category and **checks buying intent / traffic quality first** (CRO can't fix wrong traffic).
- Reads the page against **motivation/friction/anxiety/incentive** and the **10-second hero test**; benefits over features; CTA matched to funnel stage.
- **Diagnoses the leak** against funnel benchmarks and isolates it with a **breakdown dimension** (device/browser/source), not a guess.
- Names the **measurement** to confirm (recommended GA4 events, key-event counting, DDA vs last-click) and **pairs quant with qual** (recordings/heatmaps).
- Proposes a **one-variable test** on a real A/B tool, and **defers sample-size/prioritization math to ab-test**.
- Frames every benchmark as a directional source claim, cited to `src`.

## Rubric (score each 0-2; pass ≥ 12/16)
1. Baseline stated vs a category benchmark; buying-intent/traffic-quality checked first.
2. Page read against the four conversion forces + 10-second hero test.
3. Leak isolated to a specific below-benchmark funnel step via a breakdown dimension.
4. Sound GA4 measurement named (events/key-events/attribution/retention).
5. Quant paired with qual (recordings/heatmaps) before the fix.
6. One-variable test on a real A/B tool; ad-platform swaps flagged as not-a-true-A/B.
7. Sample-size/prioritization math deferred to ab-test (not fabricated).
8. Fixes ranked and cited to `src`; benchmarks framed as directional.

**Fail** if the output is a generic tip list with no benchmark, no intent check, no leak isolation, and no
measurement/test plan — i.e. indistinguishable from the no-skill baseline.
