---
name: cro
description: Audit or improve conversion rate against source-cited CRO methodology — the motivation/friction/anxiety/incentive model, hero/CTA/value-prop heuristics, funnel-leak diagnosis against benchmarks, GA4 event/attribution measurement, quant+qual pairing, and page/element optimization (forms, social proof, speed, mobile). Use when a page/funnel converts poorly, diagnosing where visitors drop, planning a CRO experiment, or setting up conversion measurement. Not Shopify-specific checkout mechanics (shopify) and not deep A/B statistics — sample size, significance, ICE/PIE (ab-test); this is the conversion strategy + diagnosis layer.
user-invocable: true
context: fork
argument-hint: [page/funnel to audit or CRO task]
---

## What this skill is

A conversion-rate-optimization partner distilled from an **Analytics & CRO** corpus. It turns conversion
heuristics and analytics practice into an executable diagnosis-and-fix loop so a model doing CRO pulls the
right rule and *actions* it: reads the page against the motivation/friction model, finds the funnel leak
against a benchmark instead of guessing, measures it correctly in GA4, and pairs the numbers (*where*) with
recordings (*why*) before proposing a test.

Load the depth file — don't guess: `references/knowledge-base.md` (conversion principles, funnel/journey
analysis, analytics/measurement, experimentation, page/element optimization — each rule cited to its source).

## When to load
- A page or funnel converts below expectation and you need the root leak, not a guess.
- Auditing a hero/landing/PDP/checkout for clarity, friction, and CTA fit.
- Setting up or fixing GA4 measurement (events, key events, attribution, cohorts).
- Planning a CRO experiment or prioritizing what to test.

## The workflow

Run the stages relevant to the task — each cites a rule from the KB (§ + `src`).

### 1 — FRAME the conversion (§principles)
Establish the current conversion rate and compare to a **category benchmark** before judging. Check the
prerequisite: CRO only pays when traffic has **buying intent** — a perfect page can't sell an unwanted
product. Read the page against the four forces: raise **motivation**, lower **friction**, reduce
**anxiety**, apply **incentive**. Lead with feeling/outcome (benefits, not features); make the hero pass the
**10-second test** (what you do / how life improves / next action); match CTA commitment to funnel stage.

### 2 — DIAGNOSE the funnel (§funnel)
Map the ordered steps (macro vs micro conversions). Diagnose leaks **against benchmarks** (warm opt-in
~30–40%, cart-to-purchase ~40–50%), not in a vacuum. Isolate hidden leaks with breakdown dimensions
(device / browser / traffic source) and a next-action (page_path) breakdown at the biggest drop-off.

### 3 — MEASURE it right (§analytics)
Instrument events in snake_case with GA4 recommended names; register custom params as Custom Definitions;
mark **Key Events** with the correct counting method (purchase=every, lead=once/session). Compare
Last-Click vs **Data-Driven** attribution to find mis-valued channels; set data retention to 14 months.
Then **pair quant with qual** — funnel/GA4 shows *where*, session recordings + heatmaps show *why* (watch
the consent-signal gotcha that fragments sessions).

### 4 — TEST & OPTIMIZE (§experimentation, §page)
Treat CRO as continuous experimentation; isolate **one variable** per test on a real A/B tool (ad-platform
asset-group swaps are not true A/B — confirm significance). Highest-leverage element fixes: reduce form
fields + sensible defaults, ≤5 nav links, ethical delayed pop-ups, **specific** UGC social proof, 1–2 accent
colors reserved for CTAs, ethical urgency + non-dead-end thank-you pages, a separate mobile audit, and page
speed (a 1s delay can cut conversion ~7%).

> Prioritization frameworks (ICE/PIE), hypothesis templates, and sample-size/significance/duration math are
> **not** in this KB — defer those to the `ab-test` skill; don't fabricate them.

## Output contract
Return, in order:
1. **Baseline + intent check** — current rate vs benchmark, and whether traffic has buying intent.
2. **Leak diagnosis** — the specific funnel step(s) below benchmark, with the breakdown dimension that isolates it.
3. **Ranked fixes** — highest-leverage first, each mapped to a KB rule (cited); name the measurement to confirm.
4. **Grade** — score against the checklist; name the single highest-leverage fix and the test to run.

## Constraints (what NOT to do)
- **Never optimize a page before checking traffic intent / product-market fit** — CRO can't fix wrong traffic.
- **Never judge a conversion rate without a category benchmark** — "low" is relative.
- **Never trust an ad-platform asset-group swap as a true A/B test** — confirm statistical significance.
- **Never change more than one variable per test.**
- **Never optimize on raw analytics without the consent/measurement gotchas handled** (form-interaction false positives, session-fragmenting consent, 2-month retention default).
- **Never present benchmarks as fixed truth** — they drift by sector/date; re-verify against the target's own baseline.

## Verify (executable acceptance)
- [ ] Current rate is stated against a category benchmark, and buying-intent is confirmed first.
- [ ] The leak is a specific below-benchmark funnel step, isolated with a breakdown dimension (not a guess).
- [ ] Measurement is sound (recommended events, key-event counting, DDA vs last-click, 14-month retention).
- [ ] Quant is paired with qual (recordings/heatmaps) before proposing the fix.
- [ ] Fixes are ranked, one-variable-testable, and each cites a `src`; sample-size math is deferred to ab-test.
- [ ] Benchmarks framed as directional source claims, not fixed truth.
