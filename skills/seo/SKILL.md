---
name: seo
description: Run or audit an SEO strategy against source-cited methodology — search-intent/keyword selection, topical-authority content, technical/indexation SEO, link building, Local SEO / Google Business Profile, and AEO/GEO (AI-search) visibility. Use when planning keywords, diagnosing why a page won't rank, building a content/link plan, optimizing a Google Business Profile, or making a site cited by AI answers. Not the audit runner (audit orchestrates the checks/tools) and not deep AEO execution (aeo-optimize) — this is the strategy/decision layer they draw on.
user-invocable: true
context: fork
argument-hint: [seo audit / keyword / local / AEO task]
---

## What this skill is

An SEO strategy partner distilled from two corpora — an **SEO Masters** notebook (keyword/on-page/
technical/link/AEO) and a **Local SEO & Google Business** notebook. It turns ranking factors and tactics
into an executable decision layer so a model doing SEO pulls the right rule and *actions* it: picks
winnable keywords by intent and difficulty, builds topical authority instead of stuffing keywords, clears
the indexation blockers first, and earns the mentions/links that move both classic and AI search.

Load the depth file — don't guess: `references/knowledge-base.md` (keyword strategy, on-page/content,
technical, off-page, Local/GBP, AEO/GEO — each rule cited to its source).

## When to load
- Choosing/vetting keywords or diagnosing why a page can't rank.
- Building a content plan (pillar/cluster, E-E-A-T, answer-first structure).
- Technical/indexation triage (noindex, robots, JS rendering, schema, redirects/canonicals).
- Link building / digital PR / branded-mention strategy.
- Local SEO / Google Business Profile optimization.
- Making a site visible/cited in AI Overviews, ChatGPT, Perplexity.

## The workflow

Run the stages relevant to the task, in order — each cites a rule from the KB (§ + `src`).

### 1 — INTENT & KEYWORDS first
Read the live SERP before writing: the content **format must match the dominant intent of the current top
3** or it can't rank. Filter for winnability (DR+10 rule; lowest-DR ≤30 in top 5). Prefer traffic-potential
and conversion path over raw volume. Against AI Overviews, favor **action/tool queries** (calculator,
generator, checker) that AI can't satisfy.

### 2 — ON-PAGE & CONTENT
Build **topical authority** (cover the entity graph), not keyword density. Pillar-and-cluster with
reciprocal internal links; never run competing pages (consolidate). Lead each heading with the exact
question answered in the first sentence (chunking). Prove **E-E-A-T** with credentialed authors,
firsthand data, and identical identity across platforms. Keep a real "Last Updated" and refresh decliners.

### 3 — TECHNICAL / INDEXATION
Clear blockers first — a `noindex` or robots block disqualifies the page. Confirm AI crawlers aren't
blocked (GPTBot/OAI-Searchbot); submit to Bing (ChatGPT pulls from it). Deliver static structured HTML
(AI bots don't run heavy JS). Ship the schema stack (Organization + Product/Service + LocalBusiness) with
a precise machine-readable **entity**. Use 301 (not 302) to consolidate; never bulk-redirect to the
homepage. Apply Google's CWV thresholds (LCP≤2.5s / INP≤200ms / CLS≤0.1 — external, not in the KB).

### 4 — OFF-PAGE / LINKS
Great content doesn't earn links passively — promote it. Build **linkable assets** (frontloaded stats,
charts, free tools). Run outreach plays (outdated-stat, link-intersect, unlinked brand mentions). Avoid
PBN/Fiverr links (spam-policy wipe risk). Keep anchor text a natural mix. For **AI search, branded
mentions on authoritative sites outweigh backlinks.**

### 5 — LOCAL / GBP (if the business is local)
Rank = Proximity + Relevance + Prominence. Set the most-specific **primary category**; complete every
field; real photos only. Reviews are heavily weighted — reach 10 (milestone), sustain ≥1/week, ratings
4.7–4.9, keywords in the **customer's** text (not owner replies); never gate or batch reviews. Keep NAP
identical and purge duplicate listings. Build genuine service-area pages — never city-swap templates.

### 6 — AEO / GEO (AI-search visibility)
Treat AI visibility as a **distinct workstream** (~19% crossover with classic SEO). Diversify placements
per engine's citation bias. Win citations with **QAE** structure (Question → direct answer → evidence),
scannable formatting, multimodal assets, machine-readable entities, and high-authority mentions with
citation velocity + positive sentiment. Longer/complex queries trigger AI answers most — target them.

## Output contract
Return, in order:
1. **Diagnosis** — what stage(s) are the constraint (intent mismatch, indexation blocker, thin authority, weak links, GBP gaps, AI-invisibility).
2. **Plan** — ranked actions with the KB rule each applies (cited), highest-leverage first.
3. **Winnability check** — the difficulty/intent read for any target keyword; the funnel/conversion path.
4. **Grade** — score against the checklist; name the single highest-leverage fix.

## Constraints (what NOT to do)
- **Never target a keyword whose top-3 format your page can't match**, or one beyond the DR+10 winnability band.
- **Never chase volume with no conversion path** — traffic potential and business value first.
- **Never buy PBN/Fiverr links, gate/batch reviews, or mass-publish city-swap pages** — each risks a penalty/wipe.
- **Never present the numbers as verified fact** — they are source claims; treat thresholds as directional (except Google's CWV values).
- **Never assert `llms.txt`** from this KB — the sources don't cover it; verify externally before recommending.

## Verify (executable acceptance)
- [ ] Target keywords are intent-matched to the live SERP and inside the DR+10 winnability band.
- [ ] Content builds topical authority (entity coverage), answer-first, with real E-E-A-T signals.
- [ ] Indexation blockers checked first; AI-crawler access confirmed; schema/entity in place; 301s consolidate.
- [ ] Links come from linkable assets + outreach (no PBN); AI plan leans on branded mentions.
- [ ] For local: primary category, review velocity/quality, NAP consistency, real service-area pages.
- [ ] AI-search treated as its own workstream (QAE + entities + mentions); every claim cited to a `src`.
