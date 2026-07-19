---
name: paid-ads
description: Paid-acquisition strategy across Google/search and Meta/social in the automation era — account architecture (consolidate, don't SKAG), targeting (smart-bidding signals, broad-vs-constrain, lookalikes), bidding/budget (conversion thresholds, learning phase, vertical/horizontal scaling), creative-as-targeting (hook rate, creative diversity, RSA copy), measurement (first-party data, Enhanced Conversions, Pixel+CAPI, attribution windows), optimization (search-term/negative-keyword discipline, message-match), and where budget burns. Use when planning/auditing a Google or Meta campaign, structuring an account, setting bids/budgets, or fixing conversion tracking. NOT landing-page conversion (cro), NOT ad copy frameworks (copywriting), NOT A/B significance math (ab-test) — this is the media-buying strategy layer.
user-invocable: true
context: fork
argument-hint: [Google/Meta campaign to plan or audit]
---

## What this skill is

A paid-media partner distilled from **Google Ads & PPC** + **Meta Ads** corpora (2025–2026 automation era).
It turns media-buying strategy into an executable loop so a model running paid pulls the right rule and
*actions* it: structures the account to feed the algorithm instead of starving it, lets creative do the
targeting, feeds clean down-funnel data, and chases net profit over vanity ROAS — instead of
helicopter-editing a learning-limited ad set.

Load the depth file — don't guess: `references/knowledge-base.md` (structure, targeting, bidding/budget,
creative, measurement, optimization, failures, shared strategy — each rule cited to `[GA#]`/`[MA#]` with a
source legend).

**Scope caveat (baked into the KB):** the paid **strategy** layer. Landing-page conversion mechanics →
`cro`; ad-copy frameworks → `copywriting`; A/B significance/sample-size → `ab-test`. Numbers (CPCs, CTRs,
ROAS lifts, conversion thresholds) are directional **source claims** — they drift by sector/date; re-verify
against the account's own baseline.

## When to load
- Planning or auditing a Google Search/PMax or Meta Advantage+ campaign.
- Structuring/restructuring an ad account (consolidation vs segmentation).
- Setting a bid strategy + budget, or diagnosing "Learning Limited" / a stalled tCPA.
- Fixing conversion tracking (first-party data, Enhanced Conversions, Pixel+CAPI, attribution).

## The workflow

Run the stages relevant to the task — each cites a rule from the KB (§ + `[GA/MA#]`).

### 1 — STRUCTURE to feed the algorithm (§structure)
Structure to the **business** (P&Ls, product lines, regions, distinct goals), not the keyword list. Default
to **consolidation** to pool conversions; hyper-granular SKAGs now *starve* smart bidding. On Meta, **less
is more** — few campaigns/ad sets, combine cold+warm so conversions concentrate. Migrate legacy accounts in
sandboxed batches, never all at once.

### 2 — LET CREATIVE TARGET (§targeting, §creative)
On Google, "control" = clean conversion data + accurate smart-bidding targets + brand/geo/negative controls;
match types are a spectrum (exact→phrase→broad/AI Max), and broad/keywordless is the **prerequisite for AI
Overviews**. On Meta, **creative is the targeting** (interests are suggestions, ~30% inaccurate) — go
**broad** by default, constrain only for geo-restricted, regulated, or hyper-contextual campaigns; prefer
**Meta-source warm audiences** (iOS14.5-proof). Creative is the last real lever: **hook = first 1–3s**
(90–95% skip), track **hook rate**, run **UGC/partnership ads**, and keep **~20 diverse creatives** live
(Andromeda punishes near-duplicates) with a static/carousel/video mix.

### 3 — BID & BUDGET to thresholds (§bidding-budget)
Respect the data floors: Google **~15 conv/30d** baseline (**25–30** for tCPA or it dies); Meta **~50
conv/week/ad set** to exit the learning phase. Pool sub-threshold campaigns into a **portfolio strategy +
shared budget** and **don't touch for 30 days**. Pick the strategy to the goal (Max Conversions / tROAS /
tCPA / Max Clicks); track to the deepest funnel step that still clears volume, else a fast mid-funnel proxy.
Prefer **daily budgets**; scale **vertically** in small steps (~3%/day) then **horizontally** (new angles/
audiences).

### 4 — MEASURE clean, down-funnel (§measurement)
**"Good data in, good data out"** — track only shallow form-fills and the machine finds cheap junk. Build a
**measurement plan** mapping the real funnel (form→screen→qualified→closed) with distinct conversion
categories. Feed **first-party data** (source claim ~+30%), **Enhanced Conversions**/ECL/OCI to unlock
**value-based bidding**, and on Meta run **Pixel + CAPI** together (iOS14.5 gutted Pixel), maximize **Event
Match Quality**, respect the **8-event AEM cap**, and **add a 1-day-view attribution window** (click-only
under-reports).

### 5 — OPTIMIZE & GUARD THE OFFER (§optimization, §shared strategy)
Audit the **search-term report** (not the keyword report); **negative keywords are the steering wheel** for
broad match. Enforce **message-match** (keyword→ad→page one theme, or Google demotes). Remember the real
game is **CAC:LTV** and **net profit, not vanity ROAS** — and a strong **offer** beats every tactic; zero
traction is usually an offer-market-fit problem, not a settings problem.

## Output contract
Return, in order:
1. **Account structure** — the consolidation decision and why (business dimension, not keywords).
2. **Targeting + creative plan** — broad-vs-constrain call, and the creative/hook diversity to run.
3. **Bid + budget** — the strategy, the conversion-threshold check, and the scaling steps.
4. **Measurement** — the funnel conversion map, first-party/EC/CAPI setup, and attribution window.
5. **Grade** — score against the checklist; name the single highest-leverage fix and the profit metric to watch.

## Constraints (what NOT to do)
- **Never SKAG / hyper-segment to "control"** — it starves smart bidding; default to consolidation.
- **Never helicopter-edit inside the learning phase** — changes reset it; wait out the 30-day / 50-event floor.
- **Never run a single or near-duplicate creative** — Andromeda punishes it with higher CPM; run ~20 diverse.
- **Never optimize on shallow conversions or in-platform numbers at face value** — track down-funnel, first-party, deduped Pixel+CAPI.
- **Never use click-only attribution on Meta** — add a 1-day view or you under-report and starve optimization.
- **Never chase vanity ROAS over net profit, or expect settings to fix a weak offer** — offer-market-fit first; LP/copy/stats live in `cro`/`copywriting`/`ab-test`.

## Verify (executable acceptance)
- [ ] Account structured to a business dimension with a stated consolidation decision (not SKAG sprawl).
- [ ] Targeting is broad-by-default (or constrained for a named reason); creative-as-targeting with hook-rate + ~20 diverse creatives.
- [ ] Bid strategy fits the goal and the conversion-threshold floor is checked; scaling is small-step, learning-safe.
- [ ] Measurement maps the real funnel with first-party/EC/CAPI and a view-inclusive attribution window.
- [ ] Optimization uses the search-term report + negatives + message-match; CAC:LTV / net-profit framing present.
- [ ] Every claim cites `[GA/MA#]`; numbers framed as directional; LP/copy/stats deferred to cro/copywriting/ab-test.
