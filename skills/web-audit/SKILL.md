---
name: web-audit
description: "Source code audit for web projects — SEO config, robots.txt, redirects, caching, favicons, images, AEO files. Checks the codebase, not just the live site. Use when auditing source code before deployment, reviewing a web project, or /web-audit."
user-invocable: true
argument-hint: "[project-dir]"
---

# Web Audit — Source Code & Config Analysis

Audits the codebase that produces the live site. For live-site analysis, use `/seo-audit` or `/full-audit`.

## Phase 1: Quick Live Check

Fetch simultaneously with WebFetch:
1. **Homepage** — `<title>`, canonical, robots meta, og:image, JSON-LD
2. **Sitemap** — `/sitemap-index.xml` — www/non-www matches canonical?
3. **robots.txt** — Googlebot allowed? Sitemap referenced? Optional non-Google AI crawler policy documented?
4. **llms.txt** — optional support file exists? Proper Markdown structure?

Then WebSearch: `site:domain.com inurl:wp- OR inurl:uncategorized` — CMS remnants?

## Phase 2: Codebase Checklist

### SEO Component
- [ ] `site` config set to **www** domain
- [ ] Canonical derived from config — not hardcoded
- [ ] robots meta always renders: `index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1`
- [ ] Title ≤ 60 chars — brand suffix logic doesn't double-append

### robots.txt
- [ ] Allows: Googlebot, Bingbot, and other target search crawlers
- [ ] Optional non-Google AI crawler policy is intentional and channel-specific
- [ ] References sitemap URL (www)
- [ ] References `/llms.txt` only if the project intentionally publishes one

### Redirects
- [ ] Old CMS slugs covered (`/uncategorized/*`, `/category/*`)
- [ ] WP artifacts: `/wp-admin/*`, `/wp-login.php`, `/wp-content/*` → 301 to `/`
- [ ] Changed page slugs have 301s

### LLM / AEO Files
- [ ] Optional `/public/llms.txt` — company summary, services, key pages, contact
- [ ] Optional `/public/llms-full.txt` — includes selected FAQ content inline
- [ ] Files referenced from robots.txt only when intentionally published

### Favicon
- [ ] SVG has opaque background (not transparent), square viewBox
- [ ] `fill-rule:evenodd` preserved, brand dark color background
- [ ] `.ico` fallback and `apple-touch-icon.png` exist

### Cache Headers
- [ ] HTML: `s-maxage=86400, stale-while-revalidate=604800`
- [ ] Static assets (`/_astro/*`): `max-age=31536000, immutable`

### Images
- [ ] All images have WebP versions
- [ ] `<picture>` elements with WebP source + fallback
- [ ] Width/height attributes on `<img>` (prevents CLS)
- [ ] Lazy loading below fold, eager on LCP image
- [ ] og:image kept as JPG (social platform compatibility)

## Phase 3: Fix Priority

1. Canonical domain mismatch → fix `site` config
2. Missing robots meta → always render on indexable pages
3. 404s from old CMS URLs → add 301 redirects
4. Title > 60 chars → shorten, fix double-suffix
5. Missing llms.txt → create only if non-Google agent-consumption support is in scope
6. WebP image conversion → `cwebp -q 82`, wrap in `<picture>`
7. LCP preload → `<link rel="preload" type="image/webp">`
8. Cache headers → add `s-maxage` for edge
9. AEO gaps → evidence panels, 30-50 word FAQ answers, dates

## Common Framework Issues

| Issue | Fix |
|-------|-----|
| Canonical non-www | Set `site` to `https://www.domain.ca` |
| Title double brand suffix | Fix `.includes()` check in SEO component |
| og:image relative URL | Use `new URL(path, site)` |
| FAQ schema not rendering | Keep answers 30-50 words, add dateModified |
| AI not citing content | Add self-contained claims, evidence panels, and source dates |

## Shell Commands

```bash
# Find hardcoded non-www URLs
grep -r "https://domain\.ca" src/ --include="*.astro"

# Convert images to WebP
find public/images \( -name "*.jpg" -o -name "*.png" \) | while read img; do
  out="${img%.*}.webp"; [ ! -f "$out" ] && cwebp -q 82 -mt "$img" -o "$out" -quiet
done

# Count unconverted images
grep -r "\.jpg\|\.png" src --include="*.astro" | wc -l
```
