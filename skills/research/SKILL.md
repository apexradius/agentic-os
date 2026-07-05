---
name: research
description: "Deep research — market analysis, competitor scan, technical comparison, documentation search. Parallel agents for speed. Use when researching anything, comparing options, market analysis, or /research."
user-invocable: true
argument-hint: "[topic-or-question]"
---

# Research — Multi-Source Intelligence

One command for any research need. Auto-detects type and launches appropriate agents.

> **Absorbed aliases:** `docs-search`, `tech-compare` → use `/research` (the Documentation and Technical types below).

## Type Detection

| User Says | Research Type | Agents |
|-----------|-------------|--------|
| "competitors", "market", "landscape" | **Market** | Competitor scan + market analysis |
| "compare", "vs", "which is better" | **Technical** | Side-by-side comparison |
| "how does X work", "find docs for" | **Documentation** | Doc search + code examples |
| "research X thoroughly" | **Deep** | Multi-source comprehensive |
| "what's trending in", "industry report" | **Trend** | Market scan + web search |

## Market Research
Launch in parallel:
1. **Competitor Scan**: Top 5-10 competitors, positioning, pricing, features, strengths/weaknesses
2. **Market Analysis**: Market size, growth trends, target segments, opportunities, threats
3. **SWOT**: Synthesize into Strengths, Weaknesses, Opportunities, Threats

## Technical Comparison
```markdown
# Comparison: [Option A] vs [Option B] vs [Option C]

| Criteria | A | B | C |
|----------|---|---|---|
| Performance | | | |
| Learning curve | | | |
| Community/support | | | |
| Pricing | | | |
| [domain-specific] | | | |

## Recommendation
[Which option, for what use case, and why]
```

## Documentation Search
1. Search official docs (WebFetch on doc URLs)
2. Search GitHub for examples/implementations
3. Search community (Stack Overflow, forums, blogs)
4. Synthesize: working code example + explanation

## Deep Research
Multi-step with source verification:
1. **Broad search**: WebSearch for overview of topic
2. **Deep dive**: WebFetch on top 5-10 most relevant sources
3. **Verify**: Cross-reference claims across multiple sources
4. **Synthesize**: Structured report with citations

## Output Format
```markdown
# Research: [Topic]
**Date**: [date] | **Type**: [type] | **Sources**: [N]

## Key Findings
1. [finding with evidence]
2. [finding with evidence]
3. [finding with evidence]

## Detailed Analysis
[structured by subtopic]

## Recommendations
[actionable next steps]

## Sources
- [Title](URL) — [what it contributed]
```

## Rules
- Always cite sources with URLs
- Cross-reference claims (don't trust single sources)
- Distinguish facts from opinions
- Flag when information might be outdated
- Report confidence level: high/medium/low per finding
