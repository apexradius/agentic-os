---
name: aeo-optimize
description: "Answer Engine Optimization — optimize content for AI citations, AI Overviews, and GEO. 18-token rule, entity signals, evidence panels, FAQ optimization, llms.txt. Use when improving AI search visibility, optimizing for ChatGPT/Claude/Gemini citations, or when asked to do AEO, GEO, or AI search optimization."
user-invocable: true
argument-hint: "[url]"
---

# AEO Optimize

Optimize content for AI search citations (ChatGPT, Claude, Gemini, AI Overviews).

## The 18-Token Extraction Rule
LLMs extract self-contained sentences of ~18 tokens. Key claims must be complete, quotable statements requiring zero surrounding context.
- **Good:** "Legal suites in Calgary generate $1,200–$2,200 monthly rental income."
- **Bad:** "Our suites can help you earn good rental income from your investment."

## Authority Strategy
- **Challenger sites** (new, low authority): Aggressive — 5-7 extraction points per page, heavy citations, weekly micro-updates
- **Established sites** (top-ranked): Light touch — 1-2 points, trust credibility. Over-optimization loses ~30% visibility.

## Query Complexity Decision
- Short queries (1-2 words): 23-24% AI Overview trigger rate → optimize for traditional SERP
- Medium (3-5 words): 48% → optimize for both
- Complex (6+ words): 77% → prioritize AEO/GEO content here

## Steps
0. **Check robots.txt first** — flag blocked AI crawlers (GPTBot, OpenAI-Searchbot, ChatGPT-bot, ClaudeBot, Google-Extended). If blocked, fix first — all other AEO work is wasted.
1. **Analyze content** for citation readiness — count quotable ≤18-token sentences
2. **Apply Question-Answer-Evidence format** — rewrite major H2/H3 sections as: question → direct 1-2 sentence answer → supporting data/firsthand evidence
3. **Check FAQ quality** — answers should be 30-50 words, questions 7-12 words
4. **Check evidence panels** — each major claim needs: methodology, data source, date, limitations
5. **Check freshness** — "Last updated" dates? Updated within 10 months?
6. **Target complex queries** — identify 6+ word question phrases the content can own; these have 77% AI Overview trigger rate
7. **Generate llms.txt** — company summary, services + pricing, key pages, articles, contact
8. **Generate llms-full.txt** — same + all FAQs inline with full answers
9. **Test** — ask ChatGPT/Claude: "What is [Company]?", "Best [service] in [city]?"

## Entity Signals (Critical for AI Search)
AI engines don't scan keyword density — they query entity databases. Weak entity definition = invisible to AI.

- **Semantic triplets**: Structure key claims as Subject-Predicate-Object (e.g., "[Company] specializes in [service] for [audience]")
- **Entity consensus**: Repeat brand name + core description across all directories (Google, Yelp, LinkedIn, Crunchbase, Reddit, YouTube) — AI builds "consensus" from cross-platform repetition
- **sameAs markup**: Use `Organization` schema with `sameAs` pointing to all major directory profiles
- **Entity clarity**: Define the brand as a clear entity with: name, description, logo, location, phone, founding date, and `sameAs` links
- **"Last Updated" dates**: AI tools explicitly prioritize fresher data — add visible "Last Updated" dates to all key pages and refresh them regularly

## Anti-Patterns
- Keyword stuffing (actively harms GEO)
- FAQ answers >50 words
- Vague hedged language ("may help", "could potentially")
- Missing dates and evidence
- Pronoun ambiguity ("it" vs product name)
- Blocking AI bots in robots.txt (Cloudflare does this by default — check explicitly)
- Targeting only short queries — AI citations concentrate on complex, specific queries
- Measuring success by last-click attribution — measure brand search lift and AI citation frequency instead
