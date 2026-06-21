---
name: launch-site
description: "End-to-end website launch — brand identity, Astro scaffold, AI imagery, SEO, performance audit, deployment. Orchestrates 8+ skills. Use when building a website from scratch, launching a site, or /launch-site."
user-invocable: true
argument-hint: "[project-name] [niche] [domain]"
---

# Launch Site — Full Website Pipeline

Takes a project from zero to deployed website with brand identity, content, and SEO.

## Orchestrated Skills
1. `/brand-kit` → Color palette, fonts, voice, imagery direction
2. `/scaffold-site` → Astro project with SEO, robots.txt, llms.txt, headers
3. `/ai-image` → Hero banner, about page imagery, social preview images
4. `/component-gen` → Key page components matching brand kit
5. `/seo-audit` → Pre-launch SEO checklist (schema, meta, sitemap)
6. `/perf-audit` → Lighthouse check, CWV optimization
7. `/a11y-check` → WCAG compliance verification
8. `/deploy-verify` → Deployment confirmation and smoke test

## Workflow

### Phase 1: Identity (brand-kit)
- Generate complete brand identity for the niche
- Output: colors, fonts, voice guide, image direction
- Save to `project-root/brand/brand-kit.json`

### Phase 2: Scaffold (scaffold-site)
- `scaffold-site [project-name]` — creates Astro project
- Apply brand-kit colors/fonts to CSS variables
- Set up `src/layouts/`, `src/pages/`, `src/components/`
- Configure `astro.config.mjs` with sitemap, image optimization

### Phase 3: Content & Imagery (ai-image)
- Generate hero image matching brand imagery direction
- Generate about/team section imagery
- Generate OG image / social preview (1200x630)
- Optimize all images for web (WebP, responsive sizes)

### Phase 4: Build Pages (component-gen)
- Homepage with hero, features, testimonials, CTA
- About page
- Contact page
- Blog/journal listing
- Generate Astro components following project patterns

### Phase 5: SEO (seo-audit + aeo-optimize)
- Schema.org JSON-LD on all pages
- Meta descriptions, Open Graph, Twitter cards
- Sitemap.xml generation
- robots.txt + llms.txt for AI crawlers
- Answer Engine Optimization for AI visibility

### Phase 6: Quality (perf-audit + a11y-check)
- Run Lighthouse audit
- Fix any performance issues (image sizes, font loading, JS defer)
- WCAG 2.1 AA compliance check
- Fix contrast, ARIA, keyboard navigation issues

### Phase 7: Deploy (deploy-verify)
- Build: `astro build`
- Deploy to target (VPS via rsync, Cloudflare Pages, Vercel, etc.)
- Verify: SSL, redirects, 404 handling, sitemap accessibility
- Smoke test all pages

## Output
```
project-name/
  brand/brand-kit.json
  src/
    layouts/Base.astro
    pages/index.astro, about.astro, contact.astro, blog/
    components/Hero.astro, Features.astro, Testimonials.astro
  public/
    images/hero.webp, og-image.jpg
    robots.txt, llms.txt, favicon.svg
  astro.config.mjs
```

## Geo-Pages Variant (Location Pages at Scale)
When generating geo-targeted landing pages for service-area businesses:
- Use template with `{{city}}`, `{{region}}` placeholders
- Each page needs 60%+ unique content (not just city-name swaps)
- Unique H1: "[Service] in {{city}}" — not template-swapped
- LocalBusiness schema with city-specific address
- Human story formula: include a local reference, neighborhood mention, or project example per city
- Near Me optimization: semantic triplets (service + location + intent)
- Quality gate: warn at 30+ location pages — enforce unique content threshold
