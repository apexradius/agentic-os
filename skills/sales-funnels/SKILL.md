---
name: sales-funnels
description: Design or audit offers, sales funnels, sales-call motions, and SaaS growth mechanics against source-cited frameworks — Value Equation, Grand Slam Offer, tripwire/core/upsell architecture, VSL/webinar/application funnels, CLOSER/Rocket discovery, and PLG activation/retention. Use when constructing or pricing an offer, designing a funnel or its stages, scripting a sales/discovery call, planning traffic-to-offer flow, or working SaaS activation/expansion/churn. Not for page-level persuasive copy (copywriting) or the client proposal artifact itself (proposal-gen).
user-invocable: true
context: fork
argument-hint: [offer / funnel / sales-call / saas-growth task]
---

## What this skill is

An offer-and-funnel partner built from two corpora — a **Sales & Funnels** notebook (Hormozi-style
offers, funnels, sales calls) and a **SaaS Sales & Growth** notebook (PLG, pricing, retention). It turns
proven frameworks into an executable workflow so a model designing a revenue motion pulls the right
framework and *actions* it: structures an offer the prospect feels stupid refusing, sequences a funnel
that recoups CAC on the front end, and runs a discovery call that makes the prospect sell themselves.

Load the depth file — don't guess: `references/knowledge-base.md` (offer construction, funnel
architecture, sales-call methodology, traffic/lead-gen, SaaS growth — each rule cited to its source).

## When to load
- Constructing, pricing, or auditing an offer (value equation, tiering, guarantees, bonuses).
- Designing a funnel or any stage (lead magnet, tripwire, core, upsell; VSL/webinar/application).
- Scripting a sales or discovery call, objection handling, or follow-up cadence.
- Planning how cold/warm traffic reaches the offer.
- SaaS growth work: activation, PLG→SLG routing, retention, expansion, churn.

## The workflow

Run the stages relevant to the asset — each cites a rule from the KB (§ + `src`). Name your framework
choices before building; decision-complete, no mid-build switching.

### 1 — OFFER first (§1)
The offer precedes the funnel — a great funnel around a weak offer still fails. Run the **Value Equation**
(maximize dream outcome × perceived likelihood; minimize time delay × effort). **Trim & Stack** into a
Grand Slam Offer; apply the **textable razor**. Set three-tier anchoring (high anchor 3–10×, main, decoy),
attach objection-killing bonuses, a plain risk-reversal guarantee, and *internal* scarcity (never fake counts).

### 2 — FUNNEL architecture (§2)
Sequence `Lead Magnet → Tripwire (break-even) → Core (profit) → Upsell (5–10×)`. Never pitch a core offer
to cold traffic cold. Pick the archetype (VSL / webinar / application) by price and trust required. Design
the front end to **recoup CAC in ~30 days** — whoever can spend most to acquire a customer wins. Check the
funnel math: Human-Loop LTV:CAC floor (3:1 → 12:1 by humans in the loop), stage conversion benchmarks, and
the close-rate-as-pricing diagnostic.

### 3 — TRAFFIC into the funnel (§4)
Place traffic on the **awareness staircase**; route cold/unaware through a bridge page, never straight to
checkout. Aim the front end at break-even. For paid, diversify angles (70/30 brand/direct); validate creative
organically before spending (UGC loop). Layer the compounding channels: retargeting, referrals, affiliates/JV.

### 4 — SALES CALL (§3) — for high-ticket / application funnels
Pre-qualify (two-for-two + AI research brief). Win in **discovery**, not the pitch — pull-teeth questioning,
chunk up to the problems you sell, pre-commit. Run **CLOSER** or the **Rocket 9-box**. Close with the deposit
script + 8-second silence; reframe objections with the "very reason" close; follow up 5 touches (24h/3d/7d/14d/21d),
each value-added — never "just checking in".

### 5 — SAAS GROWTH (§5) — for product-led / subscription motions
Price the **work, not the seat** (5× arbitrage; hybrid subscription + consumption). Define **activation** as a
completed, habit-forming event and engineer the **Click-Click-Value** golden path to it. Instrument usage → PQL
scoring → PLG→SLG routing. Guard retention (GRR/NRR, leaky-bucket rule); run the churn-capture + land-and-expand playbooks.

## Output contract
Return, in order:
1. **Asset + framework** — what you're building and the named frameworks chosen (with why they fit).
2. **The build** — the offer / funnel map / call script / growth plan, structured to the KB's rules, cited.
3. **Funnel math** — the relevant benchmark or diagnostic (LTV:CAC floor, break-even target, close-rate read).
4. **Grade** — score against the checklist; name the single highest-leverage fix.

## Constraints (what NOT to do)
- **Never pitch a core/high-ticket offer to cold traffic cold** — bridge or educate first.
- **Never use fake scarcity** ("3 spots left" with no real cap) — internal scarcity or genuine caps only.
- **Never discount to close** — hold price, pull from the Bonus Bank; discounting trains buyers to wait.
- **Never cut price when the close rate is low from avatar/motion problems** — fix positioning, not the number.
- **Never present the numbers as verified market data** — they are source claims; frame them as such.
- **Never subtract from a SaaS free plan under revenue stress** — add value upward to paid.

## Verify (executable acceptance)
- [ ] The offer runs through the Value Equation and passes the textable razor.
- [ ] A funnel archetype is named and the front end is designed to recoup CAC (break-even), not to profit.
- [ ] Cold traffic is bridged, not sent straight to a core offer.
- [ ] For a sales call: discovery precedes pitch; a named framework (CLOSER/Rocket) structures it; follow-up is a value-added cadence, not "checking in".
- [ ] For SaaS: activation is a completed value event (not signup); pricing targets the work, not the seat.
- [ ] Every framework/number is cited to a `src` in the KB; scarcity is genuine; no discount-to-close.
