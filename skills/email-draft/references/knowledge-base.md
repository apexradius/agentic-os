# Email Marketing Strategy — Knowledge Base

> Source-cited from the NotebookLM notebook "Email Marketing & Sequences" (120 sources). Citations `(src: EM <id>)` = an 8-char prefix of the source id the RAG tool returned; multiple ids = corroborated. Numbers are **source claims** (mostly creator/vendor studies, ~2024-2025) — benchmarks drift, so verify against the sending platform's current dashboard before committing to a target. Scope: deliverability, list/segmentation, lifecycle flows, broadcast cadence, metrics — the strategy layer beneath drafting. Does NOT re-cover copywriting frameworks or basic subject/send-time mechanics (owned elsewhere).

## Deliverability & Inbox Placement
- Send from a **custom domain**, never a free public mailbox (gmail/yahoo now reject/spam-filter free-domain bulk senders) (src: EM ab215f70).
- Authenticate **SPF + DKIM + DMARC** before scaling; especially mandatory above **~5,000 emails/week**, but set up early regardless (src: EM bd504533, EM ab215f70).
- Placement is decided by **sender reputation + subscriber engagement**, not send volume — a large unengaged list actively *hurts* deliverability (src: EM 81393ae0, EM bd504533).
- Top driver of spam complaints = **unmet expectations**: no permission set, or clickbait subject that misrepresents the body ("your payment is pending" → sales pitch). Never trick to earn the open (src: EM bd504533, EM d81e1102).
- Design for inbox: short, mobile-first (**55%+** read on phone), one clear CTA per email; competing links/redirects raise bounce and complaints (src: EM 73f9ca0f, EM b7dde3ba).
- List hygiene is a deliverability control, not housekeeping — clean **every 6 months minimum**, up to monthly if growing fast (src: EM bd504533, EM 0b7a435e).
- Note: notebook gives no numeric bounce/complaint-rate ceilings and **no IP/domain warmup schedule** — pull those from the ESP's own current guidance.

## List Building & Segmentation
- Funnel model: **Discovery** (rented social/ads → attention) → **Capture** (lead magnet in exchange for email → ownership) → **Nurture & Convert** (on your terms) (src: EM b745eea4).
- Lead magnet must solve **one narrow, specific pain**, not a broad theme — a specific asset out-converts "10 tips" style offers (src: EM b7dde3ba, EM 4ca946a1).
- Place opt-in where high-intent readers already are (e.g. mid-content, ~**60%** down a relevant post); a bad list, not bad copy, is why lists don't convert (src: EM b7dde3ba).
- Cold (paid) traffic needs a heavier, more-convincing opt-in page than warm (organic) traffic — build separate pages per source (src: EM e054530b).
- **Double opt-in = best-practice default**: filters bots/typos/dead addresses that would clog the list; wire the confirm button to also deliver the lead-magnet download so confirmation is frictionless (src: EM b32166ae, EM 60722df2, EM c489bf72).
- **Single-list + tags/segments, never multiple lists** — a contact on N lists is billed N times and fragments data. Tags = static labels; segments = dynamic smart-filters that auto grow/shrink as tags change (src: EM b6cd4b1c, EM c489bf72).
- Personalize by **relevance, not by shoving first-name into subjects** (studies show name-in-subject can *lower* opens). Use dynamic content blocks: one email, sections shown/hidden per tag/field (e.g. student sees discount, pro sees case study) (src: EM d81e1102, EM adb64eec, EM 84b74c0c).
- For referral/network-sourced subs, remind them **how they joined** via merge tags — forgetting is the #1 driver of instant unsub/complaint (src: EM b56ef444, EM aa16152f).
- RFM-style rules (notebook has no formal RFM model): **VIP** = spent >$200 or >3 purchases/6mo → early access + non-discount perks; **Recency** win-back trigger = 60-90 days silent (src: EM 73f9ca0f, EM 23aa19c2).
- Engagement tiers: "cold" = **no open in 90 days** → re-engagement flow; **no open in 6 months** → remove (src: EM 005165f8, EM bd504533).

## Lifecycle Automation Flows
- **Welcome/onboarding** (fires on join; ~**4x** the open rate of any broadcast). Ecommerce 5-email arc: (1) deliver promised value + intro, immediate; (2) brand story; (3) social proof; (4) hero product + CTA; (5) incentive if unbought. Drives **20-25%** of email revenue alone (src: EM 73f9ca0f). Creator variant: 2 emails (story+poll immediately, best content +2 days) (src: EM c2935876, EM 005165f8). Segmenting variant: poll to self-segment, then 1 email/day for 3 days + 4th on next newsletter day (src: EM e054530b).
- **Nurture**: ~5 emails over 1-3 weeks, starting **24h after welcome** ends, every 1-2 days; problem → proof/objections → offer. Claim: can lift first-purchase rate **~50%** (src: EM 5e3c907e, EM b7dde3ba).
- **Abandoned cart** (3 emails): E1 **1h** after (friendly reminder + product image + free-ship/returns), E2 **+24h** (urgency/discount), E3 **+48h** (review + stock scarcity + final CTA). Recovers **10-15%** of lost sales. **Hard rule: pull the contact out the instant they buy** so they aren't spammed (src: EM 73f9ca0f, EM b2b78590, EM 4ca946a1).
- **Browse abandonment** (real-time, 1-2 touches on URL/category visits): if subscriber → personalized re-engagement email; if not → pop-up / web-push signup. Captures intent at zero ad cost (src: EM 4ca946a1, EM ce877ce2).
- **Post-purchase** (4 emails): (1) order confirmation, immediate; (2) how-to/product-care; (3) upsell/cross-sell (dynamic, ~day 10 — recommend, don't hard-sell); (4) review request once happy. Tag as buyer and **suppress promos for the product they own** (src: EM 73f9ca0f, EM 84b74c0c, EM efa8a662).
- **Win-back / re-engagement** (3 emails, trigger at **60-90 days** silent): (1) "we miss you" nudge + new arrivals; (2) concrete offer/urgency; (3) polite "stay or go" breakup. Reactivates **10-25%** of lapsed users and protects deliverability (src: EM 73f9ca0f).
- **Sunset/hygiene**: cold-subs (90-day non-open) enter re-engagement; click-to-stay → tag "reactivated"; ignore → auto-unsubscribe/remove. 6-month non-open = mandatory removal (src: EM 005165f8, EM c489bf72, EM bd504533).

## Broadcast & Campaign Strategy
- Weekly broadcast is the workable default — pick **one fixed day** and hold it (src: EM 93ade1a2, EM 24180860).
- Match cadence to warmth: engaged organic subs tolerate daily onboarding; **cold/recommended leads need breathing room** — space welcomes ≥3 days or hold to next newsletter day to avoid churn (src: EM e054530b). Scale can run as low as monthly for large lists, up to ~2x/week past ~30k subs (src: EM 10b96a7b, EM a87217ab).
- **Build journeys, not calendars** — behavioral automations beat batch-and-blast; ask "what did they do, what's the next best nudge" (src: EM b745eea4).
- Promotional cadence: a dedicated promo push **~once a month**; keep a **3:1 value-to-ask ratio** (≥3 genuinely useful emails before any sell/referral ask) to preserve goodwill (src: EM 43fdcc95, EM efa8a662).
- Voice over polish: "people connect with people, not pixels" — write as if emailing one person; avoid all-caps/title-case/buzzword subjects that read as ads (src: EM aa16152f, EM d81e1102).
- **Automations ≈ 30% of total ecommerce revenue**; welcome alone 20-25%. Treat flows as the compounding base and broadcasts as the top-up (src: EM 73f9ca0f, EM b7dde3ba).

## Metrics & Benchmarks (verify live; bot-inflated)
- Broadcast opens avg **~28%** (emoji subjects slightly lower, ~26%); automated emails avg **~43%** open / **~6%** CTR; welcome flows can cumulate **~72% open / ~18% click** (src: EM d81e1102, EM b745eea4, EM c489bf72).
- **Bots inflate everything**: **30-40%** of recorded opens are security scanners/preloaders, not humans; filtering can drop a reported 25% open / 2% CTR to a real **17.5% / 1.4%**. Optimize on human-only metrics or A/B tests crown the wrong winner and automations fire on fake engagement (src: EM 13bc8c39).
- Opt-in conversion by intent: generic blog traffic ~**1%**; high-intent (video) **~10%+**; warm landing pages up to **~79%** (src: EM 0b7a435e, EM e054530b).
- ROI claim ranges **$36-$42 per $1** across studies (single figure varies by source — cite as a range, not a point) (src: EM b745eea4, EM 0d275aac, EM 5e3c907e).
- Diagnose underperformance to the right layer: low opens → subject relevance/reputation/bot-filter; low clicks → CTA friction, too many links, stale content (use central snippets so a price/link edits once across all flows); clicks-but-no-sales → site/checkout (**53%** leave if load >3s), or an audience-quality problem (wrong lead magnet) — not the copy (src: EM 13bc8c39, EM 73f9ca0f, EM 11bc202c, EM 6a2c9711, EM b7dde3ba).
