---
name: market-research
description: Demand-validation and competitive-positioning strategy — the Say→Do evidence ladder (raise proof as you raise spend), Jobs/Pains/Gains customer-profile interviews, the four risk axes (desirability/feasibility/viability/adaptability), moat analysis (business-model over product over data), Blue Ocean/ERRC positioning, and the research failure modes (falling for the solution, confirmation bias, analysis paralysis, researching without a decision). Use when validating a market/idea before building, sizing a niche, running customer-discovery interviews, choosing a moat, or positioning against rivals. NOT operational competitor signal-scraping — ad libraries, SERP, keyword/backlink, social listening belong to competitor-scan/seo; this is the strategy + validation layer.
user-invocable: true
context: fork
argument-hint: [idea/market to validate or positioning task]
---

## What this skill is

A market-research partner distilled from a **Competitor Intelligence & Market Research** corpus (a
business-strategy / Strategyzer / case-study library). It turns demand validation and positioning into an
executable discipline so a model doing research pulls the right rule and *actions* it: validates desire
*before* building, raises evidence as it raises spend, interviews for real jobs/pains/gains, and picks a
moat rivals can't copy — instead of producing an "awesome spreadsheet" that's a fantasy made explicit.

Load the depth file — don't guess: `references/knowledge-base.md` (competitor analysis, market research,
audience research, positioning, tooling/signals, failure modes — each rule cited to `[MR <id>]`).

**Scope caveat (baked into the KB):** this corpus is strong on *validation and positioning strategy* and
**silent on operational signal-scraping** — no ad-library/SERP/keyword/backlink/social-listening method,
no TAM/SAM/SOM formulas, no SWOT template. For those, defer to `competitor-scan`/`seo` and the research
tools; don't invent procedures here. Numbers are directional source claims, re-verify against the target.

## When to load
- Validating a market or business idea *before* committing build spend.
- Sizing whether a niche is big enough / expandable for the model's scale need.
- Running customer-discovery interviews or turning voice-of-customer into a decision.
- Choosing a defensible moat, or positioning against rivals (value curve, ERRC).

## The workflow

Run the stages relevant to the task — each cites a rule from the KB (§ + `[MR <id>]`).

### 1 — VALIDATE DEMAND before building (§market-research)
Never build the MVP first — prove desirability first (it's cheap; often just team time). Climb the
**Say→Do evidence ladder**, raising proof as you raise spend: L1 interviews/surveys → L2 react to an
artifact → L3 light CTA (ad click, landing-page email) → L4 skin-in-the-game (refundable deposit, LOI) →
L5 irrefutable (Wizard-of-Oz, pre-sale). **Volume never changes the level** — a million clicks is still
L3. Score every idea on the **four risk axes**: desirability, feasibility, viability, adaptability.

### 2 — INTERVIEW for jobs/pains/gains (§audience-research)
Model the customer as **Jobs / Pains / Gains**. "Say" ≠ "Do" — claims reveal truth only under skin-in-the-
game. Use **structured** profile interviews (pre-map 30–40 jobs/pains/gains stickies, read each aloud
"is this you?", use **forced specificity** so the customer *corrects you* and surfaces the real insight,
capture *their* ranking; run ~15–20 for pattern). **Output a decision** — a before/after profile shift —
not notes. Pair interviews with observation of actual behavior.

### 3 — SIZE THE ARENA & READ SIGNALS (§competitor-analysis, §market-research)
Define competition **wide** (compete for the customer's whole job/mood, not the product category) and
watch the **periphery** for disruptors, not just look-alikes. TAM is not a price lever — cutting price adds
accessibility, not market. Enter a niche too small/new for incumbents, then expand it (more problems /
new form factor / lower entry barrier). Read maturity signals: consumer apathy, store-growth outpacing
customer-growth (→ consolidation), product homogeneity (→ price war). Time to the S-curve / accessibility
shocks.

### 4 — PICK A MOAT & POSITION (§positioning)
Rank moats by copy-resistance: **business-model innovation** (interlocking mechanics, no IP needed) >
supply-chain/vertical integration, proximity/scarcity, network lock-in > **product/category alone**
(a moat "only with humility") > **raw data** (usually not a moat). Escape price wars by shifting the
*model*, not the feature (components → as-a-service). Design the offer with **Blue Ocean ERRC**
(Eliminate/Reduce/Raise/Create) and a **Customer Value Scene** storyboard (pain today → friction → clearly
better tomorrow), tested with customers before building.

### 5 — AVOID THE FAILURE MODES (§failures)
Define hypotheses + pass/fail criteria **before** touching customers (else confirmation bias, pilot
purgatory, zombie projects). Don't fall in love with the solution/tech. **"Design like you're right, test
like you're wrong."** Every interview must inform a decision — research without a decision to make is waste.

## Output contract
Return, in order:
1. **The decision** this research informs, and what would change the answer.
2. **Evidence level reached** on the Say→Do ladder (and the next rung to climb), per key claim.
3. **Customer profile** — top jobs/pains/gains with *their* ranking, and the profile shift found.
4. **Arena + moat** — the wide competitive frame and the chosen defensible position (with ERRC if designing).
5. **Grade** — score against the checklist; name the single highest-leverage next experiment.

## Constraints (what NOT to do)
- **Never treat "say" evidence (interviews/surveys/CTR volume) as proof of demand** — climb to a "do" rung before betting.
- **Never build the MVP as the first experiment** — validate desirability first; the MVP is ~1 of many tests.
- **Never present a spreadsheet/business case as evidence** — it's "a fantasy made explicit" until a real experiment runs.
- **Never define competitors by product category alone** — frame the arena by the customer's job, and scan the periphery for disruptors.
- **Never call raw data or category-creation a moat by default** — rank by copy-resistance; business-model > product.
- **Don't scrape ad libraries / SERPs / backlinks / social here** — defer operational signal-gathering to `competitor-scan`/`seo`; cite `[MR <id>]` for every strategy claim and frame numbers as directional.

## Verify (executable acceptance)
- [ ] Demand is validated on the Say→Do ladder with the reached level named and the next rung identified.
- [ ] Customer modeled as jobs/pains/gains from structured, forced-specificity interviews → a decision, not notes.
- [ ] The competitive arena is framed wide (by job) with a periphery/disruptor check; TAM reasoned, not price-driven.
- [ ] The chosen moat is ranked by copy-resistance (business-model over product/data), with ERRC if an offer is designed.
- [ ] Failure modes are guarded (pre-set pass/fail criteria; a decision the research serves).
- [ ] Every claim cites `[MR <id>]`; operational scraping deferred to competitor-scan/seo, not invented here.
