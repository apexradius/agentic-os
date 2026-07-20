---
skill: market-research
---
# Eval: market-research

A failing-baseline eval — without the skill the agent runs a surface "market research" pass (Google the
market size, list competitors, assert TAM) and blesses the idea; with it, the agent validates demand on the
Say→Do ladder, interviews for jobs/pains/gains, frames the arena wide, and picks a copy-resistant moat —
refusing to call "say" evidence proof.

## Baseline
Prompt the agent **without** the market-research skill loaded:

> "I want to launch a premium reusable-bottle brand. Do the market research and tell me if it's worth building."

Observed baseline failure: the agent reports a TAM number from a Statista-style search, lists 4–5
competitors, notes trends, maybe a SWOT, and concludes "large growing market, worth pursuing" — or advises
"build an MVP and see." No demand validation before spend, no evidence ladder, no jobs/pains/gains, no moat
analysis, and "people say they'd buy it" treated as proof. A confident brief resting on "say" evidence and
a spreadsheet.

## Pass
With the market-research skill loaded, the agent:
- Refuses to bless the idea on desk research; defines **the decision** and climbs the **Say→Do ladder**, naming the evidence level reached and the next rung (e.g. a landing-page CTA or refundable pre-order) before recommending build spend.
- Models the customer as **jobs/pains/gains** via structured, forced-specificity interviews, and outputs a **decision/profile shift**, not notes; distinguishes "say" from "do."
- Frames the **arena wide** (competes for the job, not the category) and scans the **periphery** for disruptors; reasons TAM to the model's scale need instead of treating price as a TAM lever.
- Ranks a **moat** by copy-resistance (business-model > product/category > raw data) and, if designing the offer, applies **ERRC** + a Customer Value Scene.
- Guards the **failure modes** (pre-set pass/fail criteria, "design like you're right, test like you're wrong," a decision the research serves).
- **Defers operational signal-scraping** (ad libraries/SERP/backlinks/social) to competitor-scan/seo, and cites `[MR <id>]` with numbers framed as directional.

## Rubric (score each 0-2; pass ≥ 12/16)
1. Demand validated on the Say→Do ladder; level reached + next rung named before build spend.
2. Customer modeled as jobs/pains/gains via structured, forced-specificity interviews → a decision.
3. "Say" vs "Do" distinguished; interview/survey/CTR volume never treated as proof of demand.
4. Arena framed wide (by job) with a periphery/disruptor check; TAM reasoned, not price-driven.
5. Moat ranked by copy-resistance (business-model over product/data); ERRC applied if designing an offer.
6. Failure modes guarded (pre-set criteria; research serves a decision; no spreadsheet-as-evidence).
7. Operational scraping deferred to competitor-scan/seo, not fabricated.
8. Every claim cites `[MR <id>]`; numbers framed as directional, not benchmark.

**Fail** if the output is a TAM number + competitor list + "worth building" conclusion resting on desk
research and "say" evidence — i.e. indistinguishable from the no-skill baseline.

## Results — 2026-07-19 (first execution)
Solvers: claude-sonnet-5 subagents (mirrors production agents); grader: claude-opus-4-8 subagent vs rubric with per-item evidence; spot-checked by session lead.

| Arm | Score | Verdict |
|---|---|---|
| Baseline (no skill) | 4/16 | FAIL — invented CAC/COGS/TAM/margin figures stated as fact, desk-research build verdict, no evidence ladder |
| With skill | 16/16 | PASS — evidence ladder, JPG hypothesis, say/do discipline, moat analysis; fabricated nothing, flagged its own category claims "unverified — I believe" |

Delta +12.
