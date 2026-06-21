---
name: competitor-scan
description: "Analyze a competitor — tech stack, meta strategy, schema, content, pricing, ads, social, value gaps. Use when researching competitors, competitive analysis, or /competitor-scan."
user-invocable: true
argument-hint: "[competitor-url]"
---

# Competitor Scan

Deep analysis of a competitor's web presence.

## Steps
1. **Fetch homepage** — WebFetch to extract: title, description, schema types, tech stack signals
2. **Fetch sitemap** — page count, URL structure, content categories
3. **Analyze meta strategy** — title patterns, description patterns, keyword focus
4. **Check schema markup** — what JSON-LD types they use
5. **Check AEO** — llms.txt present? AI crawlers allowed? FAQ schema?
6. **WebSearch** — `site:competitor.com` for page count, `"competitor name"` for backlinks/mentions
7. **Compare against your site** and generate differentiators
8. **Pricing analysis** — identify pricing model (per-seat, usage, flat, freemium), price anchoring, guarantee structure
9. **Value Scene gap analysis** — what job-to-be-done does the competitor solve? For which stakeholder types (end user, economic buyer, influencer)?
10. **Ads research** — check Meta Ads Library for ads running 6+ months (longevity = profitable), Similar Web for traffic sources
11. **Output** comparison matrix + actionable recommendations + "Ownability Gap" (what visual/messaging space competitors have NOT taken)

## Innovation Lens
Apply the "Strategy Smell Test": Is our differentiation a choice where making the opposite choice also wouldn't look stupid? If yes → we haven't found a real differentiator.

Apply "Value Proposition Canvas":
- Customer Profile: jobs-to-be-done, pains, gains
- Value Map: pain relievers, gain creators, products/services
- Fit: does the value map address the customer profile better than the competitor?

## Anti-Patterns
- Copying the competitor's "plateau" behaviors (what they do NOW that they're successful) vs. their "rise" behaviors (what got them there) — use Web Archive to see historical page evolution
- Treating competitor pricing as the ceiling — price based on value delivered, not what others charge
- "Innovation Theater": analyzing competitors without translating findings into specific product/positioning changes

## Tools
- Meta Ads Library (competitor ads running 6+ months)
- Similar Web (competitor traffic breakdown by source)
- Web Archive / Wayback Machine (historical positioning evolution)
- Everbee (Etsy competitor sales estimation)
- E-rank (Etsy keyword and competitor analysis)
