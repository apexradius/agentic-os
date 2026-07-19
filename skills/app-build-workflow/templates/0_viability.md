# Gate 0 — Viability Kill-Test

> Run this BEFORE `00_build_intake.md`. Hours, not days. Any hard fail → STOP, report, draft no spec docs.
> Purpose: catch distribution / mechanism / policy / archetype kills in a weekend, before spec effort is sunk.
> Five cheap checks. Verify claims against LIVE primary sources (store guideline text, platform docs, real ad/CAC data, competitor funding) — not memory. Negative claims ("no API for X", "the store forbids Y", "no funded competitor") are the highest-risk; confirm before asserting.

## App under test
- Idea (one sentence):
- Target platform(s):
- The single load-bearing promise (what the app must do or it's pointless):

## Check 1 — Distribution + unit economics
- Realistic acquisition channel for the actual budget (name it; "we'll go viral / do SEO" is not a channel):
- Pre-Launch Demand Test (e.g. $10/day Waitlist Ad Campaign or Pop-Up test):
- Pricing Break-Even (Have fixed/variable expenses and personal paycheck requirements been factored into minimum pricing?):
- Order-of-magnitude CAC (what does one paying user cost via that channel?):
- LTV (price × realistic retention):
- Irresistible Offer Margin (Is the initial offer highly profitable without resorting to cheap discounts?):
- **CAC vs LTV verdict:** [ ] clears  [ ] marginal  [ ] underwater → **KILL**
- Evidence / source:

## Check 2 — Mechanism feasibility
- The core mechanism (the thing the promise depends on):
- Named platform API / primitive that does it (or "spike required"):
- Can it run in the real-world condition, not just a warm lab? (e.g. app suspended, device offline, second account):
- **Verdict:** [ ] primitive exists / spike passed  [ ] needs redesign  [ ] no path → **KILL**
- Evidence / source (doc link or spike result):

## Check 3 — Platform-policy legality
- Data categories + user category involved (health, kids, finance, etc.):
- Relevant store guideline / regulation, quoted from the LIVE text:
- Does the chosen architecture comply?  [ ] yes  [ ] needs change  [ ] forbidden → **KILL/redesign**
- Evidence / source (guideline section number + quote):

## Check 4 — Wedge reachability
- The gap this fills:
- Free / incumbent competitors already in that gap (name them; search the store):
- Is the wedge reachable past them, or walled by their distribution?  [ ] reachable  [ ] walled → **KILL/reposition**
- Evidence / source:

## Check 5 — Archetype & moat durability
> The single most predictive filter (earned across ~30 killed candidates + a screen of our own shipped products, 2026-07-13). Name what you are *actually* competing against and who ships the value.
- **Incumbent archetype** — classify what you compete against:
  - [ ] expensive human labor  [ ] fragmented legacy market → **winning archetype** (agents do verifiable work faster/cheaper; the market can't ship the feature itself)
  - [ ] a wedge beside a dominant/frontier **platform** (its marketplace, API, or ecosystem) → **KILL** — the platform is both competitor and landlord: it ships the feature natively when it matters, a funded incumbent already owns it, or its app runtime can't hold your promise.
- **Native-platform risk** — does the platform this plugs into already ship this, or trivially can (search the live feature/pricing)?  [ ] no  [ ] yes / imminent → **KILL**
- **Funded-incumbent risk** — does a funded or established player already own this exact wedge (search funding + live product, primary source; "no competitor" is a failed search until proven)?  [ ] none  [ ] exists → **KILL / reposition to an unowned narrow vertical**
- **Operability at scale** — can the actual team (N people + agents) operate AND support this at volume, or does each unit need scarce human judgment / credential sign-off that caps throughput?  [ ] operable  [ ] bottlenecked → **KILL or reprice as a done-for-you service, not SaaS**
- **Output verifiability** — is quality provable (verifiable output), or a pure trust sale an unknown vendor struggles to win (SOC2-as-gate, breach = fatal)?  [ ] verifiable  [ ] trust-sale risk → not a kill alone; record the proof burden
- **Moat Defensibility** — does the business rely on easily replicated features (bloated menus, standard amenities, price-cutting) or a highly defensible system (e.g. a proprietary "Flavor Bomb", remarkable high-touch client experiences, automated operating systems)? [ ] highly defensible [ ] easily replicated → **KILL or redesign**
- **Verdict:** [ ] winning archetype, moat durable  [ ] survives only repositioned as a service  [ ] platform / funded-incumbent trap → **KILL**
- Evidence / source (competitor funding + native-feature URLs):

## Gate 0 verdict
- [ ] All five checks clear → proceed to `00_build_intake.md`.
- [ ] One or more hard fails → **STOP.** Record which check killed it and why. No spec docs.
- Optional de-risk before proceeding: cheapest test that would settle the weakest check (e.g. $200 pre-launch waitlist ad campaign targeting a tight 5-mile radius, a weekend pop-up/model-call trial to verify physical demand, one-day platform spike, free pre-submission policy inquiry).
