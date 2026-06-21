---
name: campaign
description: "Full marketing campaign — research, creative brief, AI images + video, ad copy, email sequences, social content. Orchestrates 8+ skills. Use when planning a campaign, product launch marketing, or /campaign."
user-invocable: true
argument-hint: "[brand] [product-or-service] [goal]"
---

# Campaign — Full Marketing Campaign Pipeline

Creates a complete marketing campaign from research to ready-to-publish assets.

## Orchestrated Skills
1. `/competitor-scan` → Analyze competitor positioning and messaging
2. `/market-scan` → Market landscape, trends, audience insights
3. `/content-brief` → Campaign brief with messaging framework
4. `/ai-image` → Ad creatives, social posts, thumbnails
5. `/ai-video` → Product demos, social reels, hero videos
6. `/ai-ad` → Complete ad packages per platform
7. `/email-draft` → Email sequences (launch, nurture, promo)
8. `/seo-audit` → Optimize landing page for organic + AEO

## Workflow

### Phase 1: Research (competitor-scan + market-scan)
- Identify top 5 competitors and their messaging
- Map market positioning and gaps
- Define target audience personas
- Identify trending topics and angles

### Phase 2: Strategy (content-brief)
- Campaign name and theme
- Key messages (primary + 3 supporting)
- Unique selling proposition
- Content pillars and angles
- Channel strategy (which platforms, what format)

### Phase 3: Visual Assets (ai-image + ai-video)
- **Hero creative**: Main campaign image in all required sizes
- **Product shots**: 4-6 styled product images
- **Lifestyle shots**: 3-4 in-context usage images
- **Social variants**: Platform-optimized crops (1:1, 9:16, 16:9)
- **Video**: Product spotlight (5s), lifestyle reel (8s), testimonial backdrop (5s)

### Phase 4: Ad Creatives (ai-ad)
Per platform (Instagram, Facebook, TikTok, Google):
- 3 image ad variants
- 1-2 video ad variants
- 3 copy variants (A/B/C testing)
- Headline + description + CTA for each

### Phase 5: Email (email-draft)
- Launch announcement email
- 3-email nurture sequence
- Promotional/offer email
- Cart abandonment recovery (if e-commerce)
- Each with subject line A/B variants

### Phase 6: Landing Page SEO (seo-audit + aeo-optimize)
- Optimize campaign landing page
- Schema markup for offers/products
- AI-engine visibility optimization

## Output Structure
```
campaigns/[campaign-name]/
  brief/
    research.md
    strategy.md
    content-brief.md
  images/
    hero/ (all sizes)
    product/ (4-6 shots)
    lifestyle/ (3-4 shots)
    social/ (platform crops)
  video/
    product-spotlight.mp4
    lifestyle-reel.mp4
    backdrop-loop.mp4
  ads/
    instagram/ (images + copy)
    facebook/ (images + copy)
    tiktok/ (video + copy)
    google/ (display + copy)
  email/
    launch.html
    nurture-1.html
    nurture-2.html
    nurture-3.html
    promo.html
```

## Influencer Campaign Structure
Use micro-influencers (10K-100K followers) as default -- they generate 36% positive ROI vs mega-influencers who lose money 59% of the time.

**Tiers:**
- Nano (1K-10K): Highest engagement, best for niche products, lowest cost
- Micro (10K-100K): Best ROI sweet spot -- use as primary channel
- Mega (1M+): Brand awareness only, not conversion -- avoid unless budget is very large

**Per-creator setup:**
1. Assign unique UTM parameters per creator (utm_source=creator_name)
2. Give each creator a campaign hashtag + unique discount code for attribution
3. Track incrementality (not last-click) -- use holdout groups or lift studies

**RICE Framework for Platform Selection:**
- Reach: How many of your target audience are on this platform?
- Impact: How well does this platform format match your product (visual, demo, etc.)?
- Confidence: Do you have proven creative for this format?
- Effort: What does production cost per post on this platform?

Pick the platform where Reach x Impact / Effort is highest before Confidence.

## Campaign Decision Criteria
- Only scale campaigns that are consistent and profitable -- increase budget 20-30% every few days max
- Refresh creative monthly for budgets under K/month; weekly for high-budget accounts
- Ad fatigue signal: CTR drops 25%, CPC jumps, or cold audience frequency exceeds 3
- Use Broad targeting (age/gender/location only) unless you have 1,000+ actual customer records for Lookalike
- Switch destination to Messages if Leads campaign produces low-quality results

## Anti-Patterns
- Never stack detailed interest targeting -- it handcuffs the algorithm and raises CPMs
- Never touch ad settings within 72 hours of launch -- learning phase needs at least 7 days for small budgets
- Never run Audience Network placements -- cheap clicks from accidental mobile game taps
- Never equate more course content with more value -- customers pay premium for a 3-step result, not 50 steps
- Never use mega-influencers for conversion campaigns -- 59% lose money; redirect budget to micro tier

## Niche Variants

### Health & Beauty (salons, spas, estheticians)
- Value over discounting: add bonuses (free treatment, LED, scalp detox) during slow season — never lower prices
- Content: faceless B-roll (hands on hair/skin, over-the-shoulder, mirror reveals), 5-10s clips on tripod
- Partnerships: 20 local non-competing businesses (yoga, boutiques, med spas) with referral vouchers
- Offers: package primary service + low-cost/high-perceived-value bonus

### Construction & Trades (contractors, renovations)
- Charge for consultations, offer ballpark estimates free — never give strategy away
- Content: before/after transformations, time-lapses, YouTube walkthrough videos
- Lead qualification: budget, timeline, decision-maker, scope clarity before site visit

### Real Estate (agents, brokerages)
- Never overprice to win a listing — causes price reduction battles
- Content: neighborhood guides, virtual tours, staging before/after, market data videos
- Lead gen: IDX integration, open house follow-up sequences, neighborhood expertise
