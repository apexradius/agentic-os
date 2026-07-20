---
skill: shopify
---
# Eval: shopify

A failing-baseline eval — without the skill the agent gives generic web-dev / ecommerce advice that
ignores Shopify's architecture and rules; with it, the agent uses the platform's own primitives and flags
what must be live-verified at shopify.dev.

## Baseline
Prompt the agent **without** the shopify skill loaded:

> "We're building a Shopify theme to sell on the Theme Store, and the product page needs a variant
> selector that updates price and images. How should we build it, and what do we need for submission?"

Observed baseline failure: the agent suggests editing the live theme, wires the variant selector with
ad-hoc client-side JS reading hardcoded data, reaches for jQuery, treats it like a one-client site, and
gives vague submission advice ("make it look good, be responsive") with no cross-merchant/RTL/mobile-first/
a11y specifics and no live-verify caveat. Indistinguishable from generic front-end advice.

## Pass
With the shopify skill loaded, the agent:
- Builds the variant selector with the **Section Rendering API** (or a hidden JSON script parsed client-side), not hardcoded ad-hoc JS, and keeps **Liquid server-side / JS for interaction**.
- **Never edits the live theme** — duplicate/branch, test, publish (GitHub integration).
- Uses the **section + `{% schema %}` + blocks** model and prefers **vanilla JS** + optimized assets.
- Names the real **Theme Store bar**: cross-merchant flexibility, RTL, clean App-Store-app integration, mobile-first, a11y (alt text) — and says to pull exact Lighthouse/`theme-check` thresholds from **shopify.dev**.
- Flags any numeric limit/requirement as a **source claim to live-verify**, not fact.

## Rubric (score each 0-2; pass ≥ 12/16)
1. Uses Shopify's theme architecture (folders/sections/schema/blocks), not generic file structure.
2. Variant update uses Section Rendering API / hidden-JSON, not hardcoded ad-hoc JS.
3. Liquid server-side vs JS interaction respected; no sensitive data in editable JS.
4. Never edits a live theme; duplicate/branch/publish workflow named.
5. Theme Store bar specifics (cross-merchant, RTL, mobile-first, a11y, clean code) named.
6. App/API guidance uses GraphQL Admin + correct extensibility model (if relevant).
7. Merchandising/checkout uses platform-native primitives (variants/metafields/Markets/Checkout UI ext).
8. Load-bearing numbers/rules cited to `src` AND flagged for shopify.dev live-verify.

**Fail** if the output edits the live theme, hardcodes the variant logic, reaches for jQuery, treats it as
a one-client build, or gives submission advice with no Shopify-specific bar — i.e. indistinguishable from
the no-skill baseline.

## Results — 2026-07-19 (first execution)
Solvers: claude-sonnet-5 subagents (mirrors production agents); grader: claude-opus-4-8 subagent vs rubric with per-item evidence; spot-checked by session lead.

| Arm | Score | Verdict |
|---|---|---|
| Baseline (no skill) | 8/16 | FAIL — asserted the submission bar as fact with no source, missed never-edit-live discipline and the RTL/cross-merchant bar |
| With skill | 14/16 | PASS — never-edit-live, sensitive-data-in-JS, full Theme Store bar; explicitly DECLINED to state two numbers it couldn't source (the discipline the eval rewards) |

Delta +6 — narrowest margin of the batch: two conditional rubric items (app/API, merchandising) are largely N/A for a theme-only task and scored 1/1 for both arms, compressing the spread.
