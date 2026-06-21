---
name: scaffold-site
description: "Scaffold a new Astro static site pre-configured with SEO, robots.txt, llms.txt, _headers, _redirects, favicon, and tenant config. Use when starting any new web project, or /scaffold-site."
user-invocable: true
disable-model-invocation: true
argument-hint: "[project-name]"
---

# Scaffold Site

Create a new Astro static site with all SEO, performance, and AEO infrastructure pre-configured.

## Tech Stack Selection Criteria
- **Vanilla HTML/CSS/JS** — marketing landing pages only; no auth, no state, no overkill
- **Astro** — content-heavy sites, blogs, SEO-priority pages; static output default
- **React/Next.js** — only when: user auth/registration required, complex client state, or frequent dynamic data
- **Decision rule**: choose the least powerful stack that satisfies requirements; add complexity only when forced to

## Monorepo vs Polyrepo
- **Polyrepo** (default): one repo per site; simpler CI/CD, clearer ownership
- **Monorepo**: only if 3+ sites share a component library or brand-kit package; use turborepo or pnpm workspaces

## Steps

1. **Initialize project** — `npm create astro@latest $ARGUMENTS -- --template minimal --typescript strict`

2. **Install dependencies** — `@astrojs/sitemap`, `@astrojs/mdx`

3. **Create `astro.config.mjs`:**
   - `site: 'https://www.$ARGUMENTS.com'` (confirm domain with user)
   - `output: 'static'`
   - `integrations: [sitemap(), mdx()]`
   - `build: { assets: '_assets' }`

4. **Create `src/config/tenant.ts`** — brand colors, contact info, social links, analytics IDs. Ask user for these values.

5. **Create `src/components/SEO.astro`:**
   - Props: title, description, ogImage?, schema?, noindex?
   - Canonical from `Astro.site` + `Astro.url.pathname`
   - robots meta always renders: `index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1`
   - og:image defaults to `/images/hero-main.jpg`, resolved to absolute URL
   - Title suffix logic: append brand name only if not already present

6. **Create `src/layouts/BaseLayout.astro`:**
   - favicon.svg + favicon.ico + apple-touch-icon.png refs
   - Google Fonts preconnect
   - LCP hero image preload: `<link rel="preload" as="image" href="/images/hero/hero-1.webp" type="image/webp" fetchpriority="high">`
   - SEO component with props passed through

7. **Create `public/robots.txt`:**
   - Allow: GPTBot, ChatGPT-User, Google-Extended, anthropic-ai, ClaudeBot, PerplexityBot, Googlebot, Bingbot
   - Block: CCBot, Bytespider, Diffbot
   - Sitemap: `https://www.domain.com/sitemap-index.xml`
   - LLMs: refs to `/llms.txt` and `/llms-full.txt`

8. **Create `public/llms.txt`** — Markdown template with company name, services, key pages, contact

9. **Create `public/_headers`:**
   ```
   /*
     Cache-Control: public, max-age=0, s-maxage=86400, stale-while-revalidate=604800
   /_astro/*
     Cache-Control: public, max-age=31536000, immutable
   ```

10. **Create `public/_redirects`** — WP artifact catch-all: `/wp-admin/*`, `/wp-login.php`, `/wp-content/*` → `/`

11. **Create `public/favicon.svg`** — Square viewBox, opaque background (brand dark color), white logo paths, `fill-rule:evenodd`

12. **Verify** — `npm run build` succeeds, check output for sitemap, robots.txt, _headers

## CSS Layout Patterns
- **Flexbox** — one-dimensional layouts, content-driven sizing, item-level alignment
- **Grid** — two-dimensional layouts, container-orchestrated structure, Holy Grail layouts
- **Auto-responsive grid** (no media queries needed):
  ```css
  .auto-grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr));
  }
  ```
- **Auto-height transitions** (details/accordion elements):
  ```css
  :root { interpolate-size: allow-keywords; }
  ```

## Anti-Patterns
- Never declare `width: 100%` on block-level elements — causes overflow when padding/margins are added
- Never set `outline: none` without a `:focus-visible` alternative — breaks keyboard navigation
- Avoid one-shotting full projects with AI — leads to bloated code and tech debt impossible to debug
- Nesting CSS deeper than 3 levels — bloats specificity and kills readability
- Updating frameworks unless: critical security patch or a specific required new feature
- AI-generated code often introduces OWASP Top 10 vulnerabilities (XSS, SQL injection) — always review security-sensitive logic manually
