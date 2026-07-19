# Design Standard

The taste bar for any surface a human sees — UI, frontend, or rendered document. This is the
**standard**; the deterministic anti-pattern engine and the `design-critic` role that
*enforce* it are built later and check against this file.

Brand specifics — exact color tokens, type pairings, the house "signature look" — are
**instance-specific** and live with the instance, not here. This file is the portable law:
the anti-patterns to reject and the constraints to meet, whatever the brand.

## House signature

Surfaces should feel **exact, spacious, and operational**: generous negative space,
functional over decorative, high contrast, hard hierarchy, real product/domain evidence.
Reject the generic-AI look — centered gradient hero filler, decorative orbs/blobs,
atmospheric stock darkness, glassmorphism-as-default, and one-hue palettes.

## Two registers — know which you're in

Design *serves* the work in one register and *is* the brand in the other.

- **Operational** (dashboards, admin, cockpits, internal tools, data views): clarity before
  theatre. Dark or restrained neutral shell, sharp hierarchy, compact spacing, tabular
  metrics, explicit status color, minimal ornament. No marketing hero sections, oversized
  feature cards, or conversion-page composition inside a tool.
- **Marketing / conversion** (landing pages, sites, campaigns, funnels): repeatable conversion
  architecture with real brand expression. First viewport shows the brand/product/place
  plainly, with one primary action and real imagery. Distinct per brand, but the information
  architecture and quality gates stay constant.

## Visual rules (the anti-patterns)

- **Radius:** marketing surfaces use `0`; operational UI uses a small max (≈`8px`). Never make
  every control pill-shaped.
- **Type:** body text ≥ `16px`; stable role-based sizes, not viewport-width scaling. Metrics
  use tabular numbers. **At most two font families**; a display or handwritten face never
  sets body copy. Line-height ≈ `150%` for body, `110–130%` for headings; tighten kerning on
  very large type (≳ `70px`).
- **Spacing:** an 8px grid. Sections may breathe; tools stay compact. **Never place a card
  inside another card.**
- **Color:** one dominant accent plus semantic states; maintain high contrast. Avoid
  gradient-text, side-stripe cards, purple/blue gradient domination, beige/brown monotones,
  and one-hue palettes. Status is never conveyed by color alone — pair it with text or icon.
  In the **operational** register, build the palette as a *layered neutral shell*: shift the
  background a step to separate structural zones (e.g. a lighter-gray nav on a white
  workspace), divide sections with whitespace or a soft shadow rather than borders, reserve
  the dominant accent for the primary action, and mark an active/selected state with **at
  least two** cues (e.g. fill + weight), never color alone. Do **not** distribute color by a
  fixed 60-30-10 split inside a tool — 60-30-10 is a marketing-register heuristic.
- **Depth:** never a harsh pure-black shadow. Soften it (low opacity ≈ `15–20%`, larger blur)
  and **tint the shadow toward the surface behind it**. In dark mode, separate elevation by
  *lightening* the raised surface, not by adding shadow. Backgrounds are never pure `#000` or
  `#fff` — use an off-black / off-white.
- **Motion:** animate **opacity and transform only** unless the feature genuinely needs more.
  Always respect `prefers-reduced-motion`. No decorative animation on conversion-critical or
  data-bearing interactions; motion must never hide data or cause layout shift.
- **Imagery:** real product/place/workflow/domain visuals. No atmospheric stock fill when the
  user needs to inspect the real thing.
- **Copy:** real, domain-true text. Never Lorem Ipsum or placeholder filler in a surface
  called done.
- **Controls:** icon-only actions need a label or tooltip; never ship an ambiguous icon.

## Constraints (the floors)

- **Contrast ≥ 4.5:1** (WCAG AA) for text; visible focus states; ≈24px minimum touch targets.
- **Tokenize** colors, radii, type, spacing, shadows, and motion as variables. No one-off hex
  in components outside the token definitions.
- **Reduced-motion** is mandatory, not optional.
- **Keyboard paths** for every interactive element: forms, dialogs, menus, tabs, primary
  actions.

## Required states

Every shipped UI carries the relevant **loading, empty, error, disabled, success, focus,
mobile, and permission-denied** states. Forms need validation copy and submit-busy protection.
Data views need empty and failed-fetch states. A surface that only renders its happy path is
unfinished.

## External baselines

Research proven behavior before inventing it; port the lesson into owned code — never vendor
the aesthetic wholesale:

- **shadcn/ui** — registry / code-ownership model (own the source; don't depend on opaque
  visual packages).
- **Base UI**, **React Aria / React Spectrum** — accessible unstyled primitives; the
  high-assurance reference for keyboard, screen-reader, i18n, and complex state.
- **Headless UI**, **Ark** — secondary headless references.
- Block libraries (Magic UI, Aceternity, …) — pattern scouting only; never import their look.

## Verification gate

Before any surface is called done:

1. Inspect desktop **and** mobile renders.
2. No text overflow, incoherent overlap, blank canvas, or layout shift in fixed controls.
3. WCAG AA contrast + visible focus confirmed.
4. Keyboard paths work for forms, dialogs, menus, tabs, primary actions.
5. Changed styles use tokens, not one-off values.
6. No secrets or placeholder/parked URLs in the shipped code.
7. The affected lint/test/build passed — or the exact blocked reason + next action recorded.
8. **Squint test:** at ~10% zoom (or squinting), a single focal point dominates. If every
   element competes at once, the hierarchy has failed — strip ornament until one anchor wins.

> Last reviewed: 2026-07-18
