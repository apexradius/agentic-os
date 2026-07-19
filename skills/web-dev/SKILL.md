---
name: web-dev
description: Front-end engineering craft (React/Next/Vue + modern CSS) — framework + rendering-strategy choice (CSR/SSR/SSG/ISR, App-Router routing, RSC/server-actions), components + state (local-vs-global, Context isolation in RSC, TanStack Query over useEffect, DRY co-location), modern-CSS engineering (100svh, container queries, auto-fit minmax grid, isolation over z-index, light-dark), performance (LCP/TBT/CLS, bundle/build, hydration), accessibility-as-implementation + forms-as-code (Zod+RHF, validate-on-blur, server actions + FormData), data integration (TanStack Query, Prisma/Drizzle parameterized), tooling/deploy (TS strict, Vite, env-secret hygiene, Vercel/CF Workers), testing, and failure modes (AI vibe-coding security debt, RSC CVE, over-engineering). Use when building/architecting/reviewing a front-end app or component. NOT visual-design taste (kole-jain-uiux), NOT CRO (cro), NOT SEO strategy (seo-audit), NOT WCAG audit (a11y-check) — the engineering layer.
user-invocable: true
context: fork
argument-hint: [front-end app/component to build, architect, or review]
---

## What this skill is

A front-end-engineering partner distilled from a **Web Dev** corpus (React/Next-heavy, 2026-current). It turns
front-end craft into an executable loop so a model building a web UI pulls the right rule and *actions* it:
picks the rendering strategy to the need, isolates state correctly (especially in RSC), writes modern CSS that
doesn't fight itself, wires forms as validated code, keeps secrets out of the bundle, and refuses to
blind-accept AI diffs that ship security debt — instead of a CSR SPA with prop-drilling, z-index wars, and
45%-fail-security vibe-coded forms.

Load the depth file — don't guess: `references/knowledge-base.md` (framework-architecture, components-state,
styling-responsive, performance, accessibility-forms, data-integration, tooling-deploy, testing, failures —
each rule cited `[WD <id>]` with an explicit skew + gaps note).

**Scope caveat (baked into the KB):** the *engineering* layer only. Visual-design taste / color psychology →
`kole-jain-uiux`; conversion → `cro`; SEO strategy → `seo-audit`; WCAG audit checklists → `a11y-check` (this KB
keeps a11y as *implementation patterns*). **Corpus is React/Next-heavy** (Vue second; Svelte/Astro/Angular are
name-drops) and mixes **evergreen modern-CSS craft with news/hype** — treat "newest tool" claims (V-Next, Bun,
Ripple benchmarks) as directional. **Gaps (fill from live docs / Context7, don't fabricate):** INP, deep
testing (RTL/TDD/integration), monorepo tooling, code-splitting/islands/signals.

## When to load
- Choosing a framework + rendering strategy (SSR/SSG/ISR/CSR) or structuring an App-Router app.
- Building components + state (RSC boundaries, global state, forms).
- Writing responsive/modern CSS or debugging layout/overflow/stacking.
- Wiring data (TanStack Query, Prisma/Drizzle, server actions) or a deploy/tooling/testing decision.

## The workflow

Run the stages relevant to the task — each cites a rule from the KB (§ + `[WD <id>]`).

### 1 — FRAMEWORK + RENDERING TO THE NEED (§framework-architecture)
Pick the rendering strategy deliberately: **CSR** (snappy post-load, large JS, poor SEO) vs **SSR** (crawlable,
faster FCP, needs a runtime) vs **SSG/ISR** (pre-render + background refresh). Next.js App Router = file-system
routing (`[id]` dynamic, `(group)` for sub-layouts without URL segments); React 19.2's **React Compiler**
auto-optimizes rendering (drop manual `useMemo`/`useCallback`).

### 2 — STATE ISOLATED, COMPONENTS DRY (§components-state)
Split **component-level vs global** state. Solve prop-drilling with **Context** (theme/session) or
**Zustand/Redux** (larger); in RSC, **isolate the provider in a client `AuthWrapper`** so the server layout
doesn't turn client. `useEffect` misconfigured deps cause real outages — prefer `useEffectEvent` / TanStack
Query for server state. **Extract repeated layout, co-locate single-use components** (AI codegen dumps
everything inline = instant tech debt).

### 3 — MODERN CSS THAT DOESN'T FIGHT ITSELF (§styling-responsive)
Use the modern reset: **`100svh`** (not vh/dvh — repaints), `scrollbar-gutter: stable`, `text-wrap:
balance/pretty`, **`isolation: isolate`** for clean stacking contexts (end z-index wars). Responsive **without
media queries**: `repeat(auto-fit, minmax(min(300px,100%), 1fr))`; **container queries** for
component-context styling; **`color-scheme: light dark` + `light-dark()`** for dark mode. (Defer OKLCH
perceptual rationale to design skills.)

### 4 — A11Y + FORMS AS CODE (§accessibility-forms)
Semantic HTML gives the accessibility tree for free; never blanket `outline:none` (use `:focus-visible`);
`aria-live="polite"` for toasts. **Forms:** `<label htmlFor>`↔`id`, **validate on blur** (not while typing),
render only the **first** error. **Server actions** (`"use server"` + `<form action>` reading `FormData`) with
`useActionState`; validate with **Zod + React Hook Form** (`zodResolver`, `z.infer` types).

### 5 — DATA, DEPLOY, AND DON'T SHIP SLOP (§data-integration, §tooling-deploy, §failures)
Native `fetch` over Axios; **TanStack Query** for server state; **Prisma/Drizzle** (parameterized = no SQLi;
guard the Next dev hot-reload pool with a global cached client). **TS strict**, Vite, **`.env` always
gitignored** (`process.env` / `import.meta.env`), deploy to Vercel/CF Workers on push. **Refuse vibe-coding**:
45% of AI code fails security tests — review diffs, audit RSC deps (CVE-2025-55182 was a 10.0 RCE), pin the
supply chain, hash passwords, use the ORM. **Start "one repo, one DB, one framework"** — no premature
microservices before a homepage ships.

## Output contract
Return, in order:
1. **Framework + rendering** — the strategy chosen (CSR/SSR/SSG/ISR) and why, routing shape.
2. **State + components** — the state split, RSC provider isolation, and DRY/co-location call.
3. **CSS** — the modern layout/reset/responsive approach (no z-index wars, no media-query sprawl).
4. **A11y + forms** — semantic + focus-visible + aria-live, and the validated forms-as-code plan.
5. **Data + deploy + safety** — data layer, env-secret hygiene, deploy target, and the AI-slop/security guardrail.

## Constraints (what NOT to do)
- **Never default to a CSR SPA when SEO/first-paint matters** — pick SSR/SSG/ISR deliberately.
- **Never prop-drill or turn a server layout client** — Context/Zustand; isolate RSC providers in a client wrapper.
- **Never fight z-index or scatter media queries** — `isolation: isolate`, container queries, `auto-fit minmax`.
- **Never blanket `outline:none`, validate-while-typing, or dump a wall of errors** — `:focus-visible`, validate-on-blur, first error only.
- **Never concatenate SQL, store plain-text passwords, or leave `.env` uncommitted-guard off** — ORM parameterized, hash+salt, gitignore secrets.
- **Never blind-accept AI diffs** — 45% fail security tests; review, audit RSC deps, pin the supply chain.
- **Never premature-microservice/Docker before a homepage ships** — one repo, one DB, one framework, MVP first.
- **Never state INP/testing/monorepo detail from this corpus** — gaps; fill from live docs (Context7), don't fabricate.

## Verify (executable acceptance)
- [ ] Rendering strategy is chosen deliberately (SSR/SSG/ISR/CSR) for the SEO/first-paint need — not CSR-by-default.
- [ ] State is split + RSC providers isolated in client wrappers; components are DRY/co-located, not inline-dumped.
- [ ] CSS uses modern layout (auto-fit minmax / container queries), `isolation` for stacking, `100svh`, `light-dark` — no z-index wars or media-query sprawl.
- [ ] A11y is semantic + `:focus-visible` + aria-live; forms validate-on-blur with Zod+RHF / server actions, first-error-only.
- [ ] Data layer is parameterized (Prisma/Drizzle), secrets gitignored, deploy target named; AI diffs are reviewed for the 45%-security-fail class.
- [ ] Every claim cites `[WD <id>]`; "newest tool" numbers directional; INP/testing/monorepo gaps filled from live docs, not fabricated; design/CRO/SEO/WCAG deferred to siblings.
