---
skill: web-dev
---
# Eval: web-dev

A failing-baseline eval — without the skill the agent builds a CSR SPA with prop-drilling, ad-hoc CSS, and
blind-accepted AI form code; with it, the agent picks the rendering strategy deliberately, isolates state
(RSC-aware), writes modern CSS that doesn't fight itself, wires forms as validated code, and refuses to ship
AI security debt.

## Baseline
Prompt the agent **without** the web-dev skill loaded:

> "Build the front end for a SaaS dashboard with a signup form and a list view. React. How should I structure
> it, handle state and the form, and style it responsively?"

Observed baseline failure: the agent recommends "create-react-app / a CSR SPA, lift state up and pass props
down, use useEffect to fetch data, validate the form on every keystroke, style with a CSS file using z-index
for layering and media queries for breakpoints, and here's the form code" (accepted as-is). CSR by default
(poor SEO/first-paint); prop-drilling; useEffect data fetching; validate-while-typing; z-index/media-query
sprawl; no secret hygiene; AI form code unreviewed for security.

## Pass
With the web-dev skill loaded, the agent:
- Picks a **rendering strategy deliberately** (SSR/SSG/ISR via Next App Router for a crawlable/fast dashboard),
  not CSR-by-default; uses file routing + React Compiler.
- **Isolates state** (component-vs-global), solves prop-drilling with **Context/Zustand**, **isolates the RSC
  provider in a client wrapper**, and uses **TanStack Query** for server state over raw useEffect.
- Writes **modern CSS**: `auto-fit minmax` responsive grid (no media-query sprawl), `isolation: isolate` (no
  z-index wars), `100svh`, `light-dark()` dark mode; container queries for component context.
- Wires **forms as code**: **validate on blur** (not typing), first-error-only, **Zod + React Hook Form** or
  **server actions + FormData**, `:focus-visible` + semantic HTML + aria-live.
- Uses a **parameterized ORM** (Prisma/Drizzle), **gitignored `.env`**, a named deploy target, and **reviews AI
  diffs** for the 45%-security-fail class (audits RSC deps, pins supply chain, hashes passwords).
- Starts **one repo/DB/framework** (no premature microservices), cites `[WD <id>]`, treats "newest tool"
  numbers as directional, and defers design/CRO/SEO/WCAG + fills INP/testing gaps from live docs.

## Rubric (score each 0-2; pass ≥ 12/16)
1. Rendering strategy chosen deliberately (SSR/SSG/ISR) for SEO/first-paint — not CSR-by-default.
2. State split + prop-drilling solved (Context/Zustand) + RSC provider isolated in a client wrapper.
3. Server state via TanStack Query / server actions, not raw useEffect fetching; components DRY/co-located.
4. Modern CSS: auto-fit minmax responsive (no media-query sprawl), isolation over z-index, 100svh, light-dark.
5. Forms validate-on-blur, first-error-only, Zod+RHF / server actions; :focus-visible + semantic + aria-live.
6. Parameterized ORM + gitignored secrets + named deploy target.
7. AI diffs reviewed for security (45%-fail class, RSC CVE, supply-chain pin); one-repo/DB/framework MVP-first.
8. Cites `[WD <id>]`; newest-tool numbers directional; INP/testing/monorepo filled from live docs; design/CRO/SEO/WCAG deferred.

**Fail** if the output is "CSR SPA, lift state / prop-drill, useEffect fetch, validate on keystroke, z-index +
media queries, here's the AI form code" — i.e. CSR-default, prop-drilled, validate-while-typing, no secret
hygiene, unreviewed AI code, indistinguishable from the no-skill baseline.

## Results — 2026-07-19 (first execution)
Solvers: claude-sonnet-5 subagents (mirrors production agents); grader: claude-opus-4-8 subagent vs rubric with per-item evidence; spot-checked by session lead.

| Arm | Score | Verdict |
|---|---|---|
| Baseline (no skill) | 6/16 | FAIL — recommends the CSR SPA the rubric names as the failure mode, prop-drilling, media-query sprawl, no secret hygiene, AI form code unreviewed |
| With skill | 16/16 | PASS — deliberate SSR split, RSC isolation, validate-on-blur forms, modern CSS, ORM + secrets + deploy discipline, AI-security review, fully cited |

Delta +10. Grader flag carried forward: the skill arm's CVE-2025-55182 reference is corpus-cited but was not independently verified during grading — treat as source claim, not confirmed fact.
