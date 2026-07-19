---
name: shopify
description: Build or audit Shopify theme code, apps, and store/merchandising setup against source-cited platform methodology — Liquid/section/theme-block architecture, Online Store 2.0, Theme Store submission bar, app extensibility models (embedded/UI-extensions/Functions), GraphQL Admin API, merchandising (products/collections/metafields/Markets), and Shopify-specific checkout/conversion. Use when writing theme code, prepping a Theme Store submission, building a Shopify app/extension, structuring a catalog, or optimizing a Shopify checkout. Not the theme scaffolder (shopify-theme) or store populater (shopify-store) — this is the platform-craft decision layer they draw on.
user-invocable: true
context: fork
argument-hint: [theme / app / store / checkout task]
---

## What this skill is

A Shopify platform-craft partner distilled from two corpora — a **Theme & App Dev** notebook and a
**Shopify & eCommerce** notebook. It turns Shopify's architecture and rules into an executable decision
layer so a model doing Shopify work pulls the right rule and *actions* it: structures a theme the way the
platform expects, clears the Theme Store bar, picks the correct app extensibility model, and optimizes the
checkout with Shopify's own primitives instead of generic guesses.

Load the depth file — don't guess: `references/knowledge-base.md` (theme dev, Theme Store submission, app
dev, store/merchandising, Shopify-specific conversion — each rule cited to its source).

> **Live-verify:** the KB's numbers, API limits, and Theme/App Store rules are source claims from recorded
> talks. Shopify changes these — verify anything load-bearing against **shopify.dev** before relying on it.

## When to load
- Writing or reviewing theme code (Liquid, sections/blocks, JSON templates, Section Rendering API).
- Prepping a Theme Store submission (cross-merchant flexibility, RTL, mobile-first, a11y, code bar).
- Building a Shopify app or extension (embedded / UI extension / Function; Polaris; GraphQL).
- Structuring a catalog (products/variants/collections/metafields/metaobjects/Markets).
- Optimizing a Shopify checkout/PDP/cart with platform-native tools.

## The workflow

Run the stages relevant to the task — each cites a rule from the KB (§ + `src`).

### 1 — THEME CODE
Respect the folder job-map (`layout`/`templates`/`sections`/`snippets`/`blocks`/`assets`/`config`/`locales`).
A section = markup + a `{% schema %}` (name/settings/blocks/presets); read settings via
`section.settings.<id>`. Sections = whole-unit config; blocks = merchant-reorderable children, stored in the
JSON template. Use next-gen **theme blocks** (`@theme`, `content_for "blocks"`) where the base supports it.
**Liquid is server-side only** — do pre-load work in Liquid, interaction in JS; pass data via a hidden JSON
script, never trust sensitive lookups (metafields) to editable JS. Use the **Section Rendering API** for
partial updates. Never edit a live theme directly — duplicate/branch, test, then publish (GitHub integration
to `main` for deploys). Performance: vanilla JS, `.webp` under ~200KB, uninstall unused apps.

### 2 — THEME STORE (if submitting)
Build for *many* merchants, not one: cross-business flexibility, native **RTL**, clean **App Store app
integration** without layout breakage, enforced **mobile-first**, a clean vanilla-JS code bar, and
accessibility (alt text). Base on Dawn. Pull the exact Lighthouse/`theme-check` thresholds from shopify.dev.

### 3 — APP / EXTENSION
Pick the extensibility model: **embedded app** (your server in admin iframe), **UI extension** (checkout/
POS/customer-account at extension targets — don't edit theme files), or **Function** (pricing/discount/
cart logic inside Shopify). Use `shopify app dev` (localhost, hot reload); declare custom data in the app
`.toml`. Prefer **Polaris** web components (App Bridge/CDN); build on the **GraphQL Admin API** (REST for
products/variants is deprecated); throttle against the cost/points budget. Treat API stability as sacred.

### 4 — STORE & MERCHANDISING
Complete product fields (title/benefit description/3–5 images/pricing/inventory/SEO listing). Consolidate
with **variants** (don't split products to dodge limits — hurts SEO/inventory). Use manual vs smart
**collections**; **metafields/metaobjects** for custom data (metaobjects can drive auto-generated pages).
Structure navigation (mega menu/breadcrumbs/Search & Discovery synonyms). Configure **Markets** for
localized payments/currency/duties. Structure catalog data for **agentic/AI-surface syndication**.

### 5 — CHECKOUT & CONVERSION (Shopify-native)
PDP: zoomable images + video/3D, review apps, trust badges, sticky Add-to-Cart, native low-stock. Push the
**single-step checkout**; inject **Checkout UI extensions** backed by metaobjects (admin-configurable, not
hardcoded). Enable accelerated wallets (**Shop Pay**/Apple/Google/PayPal) + guest checkout. Layer
subscriptions/Product-Network cross-sell. Turn on built-in **abandoned-cart recovery**; escalate high-value
carts via Flow. Close the retail→online loop with POS Send Cart.

## Output contract
Return, in order:
1. **Task + surface** — theme / Theme-Store / app / store / checkout, and the platform primitives in play.
2. **The build/audit** — code or plan structured to Shopify's architecture and rules, cited.
3. **Live-verify list** — any number/limit/requirement that must be confirmed at shopify.dev before shipping.
4. **Grade** — score against the checklist; name the single highest-leverage fix.

## Constraints (what NOT to do)
- **Never edit a live/published theme directly** — duplicate or branch, test, then publish.
- **Never build new integrations on the deprecated REST products/variants API** — use GraphQL Admin.
- **Never trust sensitive lookups (metafields) to client-editable JS** — resolve them server-side in Liquid.
- **Never split a product into duplicates to dodge variant limits** — it wrecks SEO and inventory.
- **Never hardcode checkout content** that could be a Checkout UI extension + metaobject.
- **Never assert a Shopify numeric limit / Theme-Store threshold / API rule from the KB as current** — verify at shopify.dev.

## Verify (executable acceptance)
- [ ] Theme changes follow the folder/section/block model and never touch a live theme in place.
- [ ] Liquid does pre-load work; JS does interaction; no sensitive data exposed to editable JS.
- [ ] App work names the correct extensibility model and builds on GraphQL Admin (not deprecated REST).
- [ ] Merchandising uses variants/collections/metafields correctly; Markets set for target regions.
- [ ] Checkout uses single-step + accelerated wallets + guest + Checkout UI extensions (not hardcoded).
- [ ] Every load-bearing number/rule is cited to a `src` AND on the shopify.dev live-verify list.
