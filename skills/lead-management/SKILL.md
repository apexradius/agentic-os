---
name: lead-management
description: Lead-ops discipline for scoring, CRM hygiene, intent capture, follow-up, and handoff — the dual-score (fit + engagement + decay) qualification model, disqualification discipline, CRM data-hygiene tactics, adaptive follow-up cadence with personalization-at-scale guardrails, sales→delivery handoff reports, and SLA/velocity dials. Use when scoring/routing leads, defining a lead-scoring model, cleaning a CRM/pipeline, designing a follow-up cadence, or fixing a handoff. Corpus is inbound-B2B-SaaS-flavored (vendor-heavy) — ship the structure, not the stats; form/lead-magnet design belongs to copywriting/cro, cadence copy to email-draft, the outreach mechanics to the outreach pipeline.
user-invocable: true
context: fork
argument-hint: [lead-scoring / CRM-hygiene / follow-up / handoff task]
---

## What this skill is

A lead-operations partner distilled from a **Lead Management & CRM** corpus. It turns lead scoring,
CRM hygiene, and follow-up practice into an executable discipline so a model doing lead-ops pulls the
right rule and *actions* it: scores a lead on fit **and** engagement (with decay), disqualifies with
discipline, keeps pipeline data clean, follows up at peak intent instead of on a rigid timer, and hands
off without dropping context.

Load the depth file — don't guess: `references/knowledge-base.md` (capture, qualification, pipeline/CRM
hygiene, nurture/follow-up, handoff/close, metrics — each rule cited to `[LM#]`).

**Read the corpus caveat first (it's baked into the KB):** the source notebook is almost entirely one
vendor's inbound-B2B-SaaS keynote material. The *discipline* transfers to any motion; the *numbers are
vendor self-reported* — treat every stat as a directional claim, never a benchmark. If your GTM motion
differs from the corpus's **inbound B2B-SaaS** (e.g. an **outbound or SMB** motion), port the inbound-
flavored tactics (anonymous-intent capture, buyer-intent triggers) deliberately — they may not map.

## When to load
- Scoring/routing a batch of leads or defining a lead-scoring model (fit + engagement).
- Cleaning up a CRM/pipeline (dedup, required properties, decay, stale-deal hygiene).
- Designing a follow-up cadence or a personalization-at-scale program with guardrails.
- Fixing a lead → sales or sales → delivery handoff that loses context.

## The workflow

Run the stages relevant to the task — each cites a rule from the KB (§ + `[LM#]`).

### 1 — SCORE with a dual model (§qualification)
Split scoring into a static **Fit** score (revenue/employees/role/industry match to who you serve) and a
dynamic **Engagement** score (recency + frequency of intent behavior, **capped per event group, with
decay** so stale clicks don't inflate priority). Combine into one prioritization number; cross a threshold
→ route to a human's binary **Qualified / Disqualified** call. Derive/refresh ICP from **Closed-Won** data
(~6-month cadence) — the profile drifts.

### 2 — DISQUALIFY with discipline (§qualification)
Concentrate capacity on the top slice of high-value fits; don't spread across every lead. On disqualify,
**force a "why"** to produce clean rejection data that refines the scoring engine; maintain a low-quality
exclusion list (click-never-buy) and feed it back as a negative audience; route bad-fit-but-real leads to
a referral partner rather than burning sales time.

### 3 — KEEP THE DATA CLEAN (§pipeline-crm)
Treat the CRM as a data project: **required properties at record creation** (stop decay at ingestion),
custom dedup rules beyond email/domain, periodic dup/missing-property scans, and auto-cleanup of stale
lists/drafts. Aim at a **single source of truth** across marketing/sales/delivery. Watch velocity: flag
**stale deals untouched past a set window**, and mine calls/emails (not just CRM metadata) for risk
signals like a decision-maker change.

### 4 — FOLLOW UP AT PEAK INTENT (§nurture-followup)
Shift from a rigid fixed sequence to **adaptive**: monitor signals, send one genuinely personalized touch
at peak intent, decide the next from the reaction. Personalization-at-scale that works is **context-rich**
(pull site + full interaction history to infer real pain), not token-stuffing. Guardrails: **prompt each
section separately** (opening / pain / close), set word limits, ban filler; automate low-risk inbound but
route high-value accounts to a **human-review queue**; **simulate on a sample set** before launch to kill
hallucinations; feed winning replies back as examples. Expect **multiple iterations** before it works.

### 5 — HAND OFF WITHOUT A CONTEXT VOID (§handoff-close)
On lead→sales or sales→delivery transition, generate a **handoff report**: stakeholders (tagged
champion/detractor), why they bought, goals, flagged risks — so the customer never has to repeat
themselves. Multi-thread to close (a B2B decision touches many stakeholders; engaging one or two is how
deals stall). Close the loop on attribution by **lead quality + pipeline movement**, not cost-per-click.

### 6 — SET SLA & VELOCITY DIALS (§metrics)
Define response SLAs (time-to-first-reply, time-to-next-reply, time-to-close) with business-hours/pausable
rules; auto-enroll to sales at a score threshold; treat bottom-funnel in hours, mid-funnel in days.

## Output contract
Return, in order:
1. **Scoring model** — the fit + engagement dimensions, the decay/cap rule, and the qualify threshold.
2. **Disqualification rule** — who gets cut, the forced-why capture, and where bad-fit leads go.
3. **Hygiene + velocity actions** — the specific CRM cleanups and the stale-deal flags to set.
4. **Follow-up plan** — the adaptive cadence and the personalization guardrails (with the human-review line).
5. **Handoff spec** — the fields the handoff report carries.
6. **Grade** — score against the checklist; name the single highest-leverage fix.

## Constraints (what NOT to do)
- **Never quote a KB number as a benchmark** — every stat is vendor self-reported; frame as directional and re-verify against the target's own baseline.
- **Never assume the inbound-B2B-SaaS motion fits your own** — for an outbound or SMB motion, port intent-capture/trigger tactics deliberately, don't copy them blind.
- **Never token-stuff personalization** (first-name/company merge ≠ personalization) — use real context or don't personalize.
- **Never let AI send to high-value accounts unreviewed** — human-review queue + pre-launch simulation on a sample set.
- **Never score on engagement without decay** — stale interactions must age out or priority inflates.
- **Don't design forms/lead-magnets or write the cadence copy here** — that's `copywriting`/`cro` (capture UX) and `email-draft` (cadence copy); this skill is the scoring/hygiene/handoff discipline.

## Verify (executable acceptance)
- [ ] Scoring is dual (fit + engagement) with an explicit decay/cap rule and a qualify threshold.
- [ ] Disqualification is disciplined (forced-why, exclusion list, referral route) — not just "low score = ignore".
- [ ] Hygiene actions are concrete (required-props-at-creation, dedup rules, stale-deal window), tied to a single source of truth.
- [ ] Follow-up is adaptive (peak-intent) with personalization guardrails and a human-review line for high-value.
- [ ] Handoff report fields are named; attribution is by lead-quality/pipeline movement, not CPC.
- [ ] Every claim cites `[LM#]`; vendor stats framed as directional, not benchmark.
