---
skill: lead-management
---
# Eval: lead-management

A failing-baseline eval — without the skill the agent scores leads on a single vague number and gives
generic "follow up and keep your CRM tidy" advice; with it, the agent scores on fit + engagement with
decay, disqualifies with discipline, and follows up at peak intent — while refusing to quote the corpus's
vendor stats as benchmarks.

## Baseline
Prompt the agent **without** the lead-management skill loaded:

> "We're getting a lot of leads from scraping Indeed and social. How should we score them and follow up so
> sales isn't wasting time?"

Observed baseline failure: the agent proposes a single 1–100 "lead score" with no fit-vs-engagement split
and no decay, says "follow up quickly and stay persistent" with a fixed 3-email cadence, "keep your CRM
clean", and may cite half-remembered "respond in 5 minutes = 9x" stats as fact. No disqualification
discipline, no handoff, no intent-decay, and no awareness that an inbound-SaaS playbook may not fit an
outbound-SMB motion. Indistinguishable from a generic sales-ops listicle.

## Pass
With the lead-management skill loaded, the agent:
- Splits scoring into a static **Fit** score and a dynamic **Engagement** score with **cap + decay**, and sets a qualify threshold that routes to a binary human Qualified/Disqualified call.
- Derives ICP from **Closed-Won** data and refreshes it (~6 mo), rather than freezing a guess.
- Applies **disqualification discipline** — forced "why" capture, an exclusion list fed back as a negative audience, and a referral route for bad-fit-but-real leads.
- Prescribes concrete **hygiene** (required properties at creation, dedup rules, stale-deal window) toward a single source of truth.
- Makes follow-up **adaptive** (peak-intent, context-rich personalization) with guardrails: prompt sections separately, human-review queue for high-value, simulate before launch.
- Specifies a **handoff report** (stakeholders, why-bought, goals, risks) and attributes by lead-quality/pipeline movement, not CPC.
- **Refuses to present the corpus's vendor numbers as benchmarks**, and flags that the inbound-B2B-SaaS origin must be ported deliberately to Apex's outbound-SMB motion.

## Rubric (score each 0-2; pass ≥ 12/16)
1. Dual scoring (fit + engagement) with an explicit decay/cap rule and a qualify threshold.
2. ICP derived from Closed-Won data and refreshed, not a static guess.
3. Disqualification discipline (forced-why, exclusion list, referral route) — not "low score = ignore".
4. Concrete CRM hygiene tied to a single source of truth (required props, dedup, stale-deal flags).
5. Adaptive peak-intent follow-up with context-rich (not token-stuffed) personalization.
6. Personalization guardrails: section-prompting, human-review for high-value, pre-launch simulation.
7. Handoff report fields named; attribution by lead-quality/pipeline, not CPC.
8. Vendor stats framed as directional (not benchmark); inbound→outbound-SMB transfer flagged; claims cite `[LM#]`.

**Fail** if the output is a single-number score with a fixed cadence and "keep the CRM clean" — i.e.
indistinguishable from the no-skill baseline — or if it quotes the corpus's vendor stats as established fact.
