---
name: email-draft
description: "Draft emails and marketing sequences — follow-up, cold outreach, welcome series, nurture flows, promo, win-back, abandoned cart. Subject line formulas, send time optimization, list hygiene. Use when writing emails, building sequences, or /email-draft."
user-invocable: true
argument-hint: "[type] [key-points]"
---

# Email Draft

> **Strategy depth — load `references/knowledge-base.md`** before designing a sequence or diagnosing
> performance. It carries the layer beneath drafting: deliverability (SPF/DKIM/DMARC, reputation,
> hygiene), list building & segmentation (single-list+tags, double opt-in, dynamic content), the full
> lifecycle flows with per-email timing/counts, broadcast cadence, and metrics (bot-inflation, benchmarks,
> layered diagnosis). Cited to source; treat numbers as source claims, verify live in the sending platform.

## Supported Types

### Transactional / Professional
- **follow-up** -- Reference previous conversation, clear next step
- **cold-outreach** -- Personalized, value-first, one clear CTA
- **status-update** -- Progress summary, blockers, timeline
- **escalation** -- Professional, factual, specific ask
- **introduction** -- Warm intro connecting two parties
- **thank-you** -- Specific, genuine, forward-looking

### Marketing Sequences
- **welcome** -- 3-email series: deliver lead magnet + set expectations + first value hit
- **nurture** -- 5-7 email flow: educate, build trust, overcome objections before pitching
- **promo** -- Launch or offer sequence: tease + open + close + last-chance
- **win-back** -- Re-engagement for inactive subscribers (6+ months no open)
- **abandoned-cart** -- 3-email recovery: nudge (1hr) + urgency (24hr) + social proof closer (48hr)

## Email Writing Rules
- No filler phrases ("I hope this email finds you well")
- Lead with value or action, not context
- One CTA per email
- Under 150 words for cold outreach, under 250 for status updates
- Match tone: formal for clients, direct for team, conversational for nurture sequences

## Subject Line Formulas
- **Curiosity gap**: "The mistake most [audience] make with [topic]"
- **Specificity**: "How [Name] got [result] in [timeframe]"
- **Direct benefit**: "[Result] without [pain point]"
- **PAS opener**: Start with the pain in the subject line, expand in preview text
- Never use deceptive subjects (e.g., "Re:" when not a reply, "Your payment is pending" for a pitch) -- destroys brand equity

## Sequence Timing
- Welcome email 1: Immediate on sign-up
- Welcome email 2: 24 hours later
- Welcome email 3: 3 days later
- Nurture cadence: Every 2-3 days for first 2 weeks, then weekly
- Win-back: Send at 6 months, 7 months; remove if still no open at 8 months

## List Hygiene (Critical)
- Remove subscribers with no opens in 6+ months -- protects sender reputation
- Deleting inactive subscribers can boost open rates dramatically (e.g., 8% to 30%)
- Never batch-blast your entire list -- segment by behavior and interest first
- Use bot-detection data (GetResponse Bot Detector) for A/B testing decisions; exclude non-human opens from ROI calculations
- Run a re-engagement campaign before deleting: "Are you still interested?" single-click confirm

## Segmentation Rules
- Segment by: purchase history, lead magnet downloaded, pages visited, email engagement tier
- Use RightMessage or Dynamic Content Builder to show different content to different segments in one send
- 3:1 value-to-ask ratio: deliver 3 value emails before every sales email

## Send Time Optimization
- B2B: Tuesday-Thursday, 8-10am or 1-3pm recipient local time
- B2C/Creator: Tuesday and Thursday evenings, Saturday morning
- Test your own list -- segment by time zone before drawing conclusions

## Copywriting Frameworks
- **PAS**: Problem + Agitation (twist the knife) + Solution
- **Perfect Intro**: "I help [target audience] achieve [result]" -- Verb Your Noun structure
- **Abandoned Cart sequence**:
  - Email 1 (1 hour): Friendly nudge with product image
  - Email 2 (24 hours): Add urgency or soft incentive (small discount)
  - Email 3 (48 hours): Customer review + final CTA

## Inbox Placement Optimization
- Authenticate: SPF, DKIM, DMARC all configured before sending
- Warm up new domains gradually (50 > 200 > 500 per day over 4 weeks)
- Keep spam complaint rate below 0.1% -- above 0.3% triggers Gmail throttling
- Avoid spam trigger words in subject: "FREE", "Guaranteed", "Act now", "Limited time offer" in caps
- Plain text version must always accompany HTML

## Recommended Platforms
- **Kit (ConvertKit)**: Best for creators -- automation, recommendations, digital products
- **GetResponse**: Best for e-commerce -- AI product recommendations, web automation
- **ManyChat**: Bridges Instagram DM/comments to email list capture

## Anti-Patterns
- Never batch-blast without segmentation -- kills engagement and trust
- Never chase vanity subscriber counts -- 1,000 engaged beats 100,000 passive
- Never share from open wounds -- only write about processed lessons with a clear takeaway
- Never perfectionism-stall on intros -- optimize for intrigue and human connection, not completeness
- Never skip list pruning -- a bloated cold list tanks deliverability for your entire domain
