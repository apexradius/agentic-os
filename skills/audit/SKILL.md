---
name: audit
description: "Unified website audit — SEO, performance, accessibility, CRO, AEO, security, redirects, images. Three tiers: quick (3 checks), standard (6), exhaustive (all 9). Generates scored report. Use when auditing any website, or /audit."
user-invocable: true
argument-hint: "[url] [quick|standard|exhaustive]"
---

# Audit — Comprehensive Website Analysis

One command, every audit. Parallel agents, unified scoring.

> **Absorbed alias:** `web-audit` → use `/audit`. The unified audit covers what the former standalone web-audit did.

## Tiers

### Quick (3 agents, ~5 min)
1. **Technical SEO** — robots, canonical, meta, sitemap, HTTPS
2. **Performance** — CWV (LCP, INP, CLS), resource loading
3. **Content** — headings, thin content, E-E-A-T signals

### Standard (6 agents, ~15 min) — adds:
4. **Schema** — JSON-LD detection, validation, recommendations
5. **Accessibility** — WCAG 2.1, contrast, keyboard, ARIA
6. **AEO/GEO** — AI crawler access, citability, llms.txt

### Exhaustive (9 agents, ~30 min) — adds:
7. **CRO** — conversion friction, UX issues, CTAs, trust signals
8. **Redirects** — chains, 404s, canonical conflicts
9. **Images** — format, alt text, dimensions, lazy loading, file sizes

## Execution
Launch all agents for the selected tier in parallel (single message, multiple Agent tool calls). Each agent receives the URL and its specific checklist.

## Scoring

| Category | Weight | In Tier |
|----------|--------|---------|
| Technical SEO | 20% | Quick |
| Performance | 20% | Quick |
| Content Quality | 15% | Quick |
| Schema | 10% | Standard |
| Accessibility | 15% | Standard |
| AEO/GEO | 10% | Standard |
| CRO | 5% | Exhaustive |
| Redirects | 2.5% | Exhaustive |
| Images | 2.5% | Exhaustive |

**Grades**: A (90+), B (80-89), C (70-79), D (60-69), F (<60)

## Report Format
```markdown
# Audit Report: [URL]
**Date**: [date] | **Score**: [X]/100 ([Grade]) | **Tier**: [tier]

## Critical Issues (fix immediately)
1. [issue] — [impact] — [how to fix]

## High Priority (this week)
...

## Quick Wins (easy + high impact)
...

## Scores
| Category | Score | Issues |
|----------|-------|--------|

## Detailed Findings
[Each agent's full output]
```

## Constraints
- Max 50 pages analyzed
- Respect robots.txt
- No paid API calls — WebFetch + WebSearch only
- Flag SPAs that need JS rendering
