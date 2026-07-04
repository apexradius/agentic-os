---
name: aeo-optimize
description: "Answer Engine Optimization — optimize content for AI citations, AI Overviews, and GEO with Google-safe SEO fundamentals, entity clarity, evidence panels, FAQ quality, and optional llms.txt support. Use when improving AI search visibility, optimizing for ChatGPT/Claude/Gemini citations, or when asked to do AEO, GEO, or AI search optimization."
user-invocable: true
argument-hint: "[url]"
---

# AEO Optimize

Optimize content for AI search citations (ChatGPT, Claude, Gemini, AI Overviews) while keeping
Google guidance separate from optional non-Google agent support.

## Claim Extraction Heuristic
Key claims should be complete, specific, quotable statements requiring little surrounding context.
Do not present a fixed token count as a Google SEO requirement.
- **Good:** "Legal suites in Calgary generate $1,200–$2,200 monthly rental income."
- **Bad:** "Our suites can help you earn good rental income from your investment."

## Authority Strategy
- **Challenger sites** (new, low authority): Add clear answer sections, strong citations, firsthand evidence, and visible update dates where freshness matters.
- **Established sites** (top-ranked): Preserve trust and readability; avoid over-optimizing content into repetitive answer blocks.

## Query Complexity Decision
- Short queries (1-2 words): usually need traditional SERP fundamentals and clear entity coverage.
- Medium (3-5 words): optimize both answer clarity and standard on-page SEO.
- Complex (6+ words): prioritize specific question-answer-evidence sections when they match real search intent.
- Any AI Overview trigger-rate percentage must include a current source and date. Without that evidence, treat query complexity as a planning heuristic.

## Steps
0. **Check indexability first** — for Google AI Search, verify Googlebot access, indexability, snippet eligibility, helpful content, and structured data where relevant.
1. **Check optional non-Google bot access** — review GPTBot, OpenAI-Searchbot, ClaudeBot, and similar robots rules only if those channels are part of the strategy. Do not score these as Google ranking factors.
2. **Analyze content** for citation readiness — count self-contained, evidence-backed claims.
3. **Apply Question-Answer-Evidence format** — rewrite major H2/H3 sections as: question → direct 1-2 sentence answer → supporting data/firsthand evidence.
4. **Check FAQ quality** — answers should be concise, accurate, and supported by the page.
5. **Check evidence panels** — each major claim needs: methodology, data source, date, limitations.
6. **Check freshness** — visible "Last updated" dates where the topic changes over time.
7. **Target complex queries** — identify specific question phrases the content can answer better than competing pages.
8. **Optional: generate llms.txt** — company summary, services, key pages, articles, contact. This supports non-Google agents/readers and is not a Google ranking factor.
9. **Optional: generate llms-full.txt** — same + selected FAQs inline with full answers.
10. **Test** — ask ChatGPT/Claude/Gemini: "What is [Company]?", "Best [service] in [city]?" Record date, prompt, model, and limitations.

## Entity Signals
AI systems and search engines benefit from clear entity information. Weak entity definition can
make a business harder to understand, but no single entity tactic guarantees visibility.

- **Semantic triplets**: Structure key claims as Subject-Predicate-Object (e.g., "[Company] specializes in [service] for [audience]")
- **Entity consistency**: Keep brand name + core description consistent across relevant directories and profiles.
- **sameAs markup**: Use `Organization` schema with `sameAs` pointing to all major directory profiles
- **Entity clarity**: Define the brand as a clear entity with: name, description, logo, location, phone, founding date, and `sameAs` links
- **"Last Updated" dates**: Add visible update dates to pages where freshness changes user trust or factual accuracy.

## Anti-Patterns
- Keyword stuffing (actively harms GEO)
- FAQ answers >50 words
- Vague hedged language ("may help", "could potentially")
- Missing dates and evidence
- Pronoun ambiguity ("it" vs product name)
- Treating non-Google AI bot access or `llms.txt` as a Google ranking factor
- Targeting only short queries when the page is better suited to specific, evidence-backed questions
- Measuring success by last-click attribution — measure brand search lift and AI citation frequency instead
- Citing AI Overview rates, crawler behavior, or ranking-factor order without a source and date
