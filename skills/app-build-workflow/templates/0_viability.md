# Gate 0 — Viability Kill-Test

> Run this BEFORE `00_build_intake.md`. Hours, not days. Any hard fail → STOP, report, draft no spec docs.
> Purpose: catch distribution / mechanism / policy kills in a weekend, before spec effort is sunk.
> Verify claims against LIVE primary sources (store guideline text, platform docs, real ad/CAC data) — not memory. Negative claims ("no API for X", "the store forbids Y") are the highest-risk; confirm before asserting.

## App under test
- Idea (one sentence):
- Target platform(s):
- The single load-bearing promise (what the app must do or it's pointless):

## Check 1 — Distribution + unit economics
- Realistic acquisition channel for the actual budget (name it; "we'll go viral / do SEO" is not a channel):
- Order-of-magnitude CAC (what does one paying user cost via that channel?):
- LTV (price × realistic retention):
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

## Gate 0 verdict
- [ ] All four checks clear → proceed to `00_build_intake.md`.
- [ ] One or more hard fails → **STOP.** Record which check killed it and why. No spec docs.
- Optional de-risk before proceeding: cheapest test that would settle the weakest check (e.g. $200 demand smoke test, one-day platform spike, free pre-submission policy inquiry).
