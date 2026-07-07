---
name: audit
description: "Unified website audit — SEO, performance, accessibility, CRO, AEO, security, redirects, images, plus a source-code pre-deploy pass. Three tiers: quick (3 checks), standard (6), exhaustive (all 9). Generates scored report. Use when auditing any website, or /audit."
user-invocable: true
argument-hint: "[url|project-dir] [quick|standard|exhaustive|source]"
---

# Audit — Comprehensive Website Analysis

One command, every audit. Parallel agents, unified scoring.

> **Absorbed alias:** `web-audit` → use `/audit`; its source-code checks are the Source-Code Audit (pre-deploy) section below.

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

## Source-Code Audit (pre-deploy)

The 9 tiers analyze a live **URL**. When the target is a **project directory** (auditing before
deploy, no live site yet), run this source pass — it catches config defects an HTTP 200 can't reveal
(the false pass: "returns 200, ship it"). Invoke `/audit <project-dir>` or `/audit <url> source`.
This is a pass/fail gate, not part of the 0–100 tier score.

Scope: only what source access adds. For source **performance** (WebP/`<picture>`, preload, cache
headers, CLS dims) use `/perf-audit <path>`; for live SEO/AEO/accessibility use the URL tiers above — don't duplicate.

- [ ] **Canonical from config** — canonical + base URL derived from one www-normalized config value,
  not hardcoded per page; a deliberate robots meta present on indexable pages
  (e.g. `index,follow,max-snippet:-1,...`) — derived and present, not equal to one fixed string;
  `<title>` ≤ 60 chars, no double brand suffix.
- [ ] **Redirect rules** — config covers old CMS slugs (`/uncategorized/*`, `/category/*`) and platform
  artifacts (`/wp-admin/*`, `/wp-login.php`, `/wp-content/*` → 301), plus a 301 for every changed slug.
- [ ] **Favicon set** — square opaque-background SVG (not transparent), `.ico` fallback,
  `apple-touch-icon.png`, all referenced.
- [ ] **AEO source files** — if the project publishes `llms.txt`/`llms-full.txt`, they exist, are valid
  Markdown, and are referenced from `robots.txt`; absent by default is fine.

```bash
grep -rn "https://<non-www-domain>" src/       # hardcoded non-www → should derive from config
grep -rcE "\.(jpg|png)" src/ | awk -F: '$2>0'  # unconverted raster images → hand to /perf-audit
```

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
