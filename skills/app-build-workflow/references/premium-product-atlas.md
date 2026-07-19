# Premium Product Atlas Track

Load this reference for a complete product design, full-app wireframe, onboarding system, dashboard, analytics surface, Mobbin research, branded prototype, or implementation-ready visual atlas.

## Output contract

Produce both:

1. `specs/09_wireframe_atlas.md` — the implementation-facing route, role, state, component, reference, and acceptance map.
2. A self-contained interactive HTML prototype under the repository's existing mockup or public artifact location.

The prototype proves the design. It does not authorize production code, live account connections, external writes, or deployment.

## 1. Establish product truth

Before visual research, inspect:

- current routes and navigation;
- user roles, tenant or workspace modes, and permissions;
- existing screens and reusable UI patterns;
- brand sources: logo, palette, type, voice, spacing, and iconography;
- business objects, real metrics, and the decisions the product must support;
- existing plans, specs, and acceptance criteria.

Do not invent a new brand because a generic design warning dislikes an established font or palette. Change brand foundations only when the request is a rebrand.

## 2. Research reference patterns

Use Mobbin when available. Search each journey or screen family separately with specific anatomy:

- onboarding with progress, ownership, blocked states, and continuation;
- connected-account setup with provider status, client-owned login, and recovery;
- operating dashboard with primary metric, comparison, attention queue, and proof;
- analytics chart with metric selector, time range, comparison, axes, tooltip, and breakdown;
- inbox or CRM list with score, owner, SLA, source, and detail pane.

Name a product only to narrow a pattern family. Inspect every returned image; metadata and app names are not evidence. Record the canonical link, observed pattern, what is adopted, what is adapted, and what is rejected.

Use the smallest strong set: usually two to four references per screen family. Prefer products that solve the same interaction problem, not products that merely look fashionable.

If Mobbin is unavailable, use current official product screenshots, design guidelines, or live competitors and state the fallback in the reference ledger.

## 3. Map the full atlas before polishing

Inventory:

- every in-scope route;
- every role, workspace, or scope mode;
- primary empty, loading, error, blocked, success, and permission states;
- first-run, returning, recovery, cancellation, and continuation paths;
- every button destination, mutation, dismissal, and cross-screen handoff.

The atlas is incomplete if a user can reach a named route or state that has no designed surface.

## 4. Apply premium visual hierarchy

The first viewport must answer, within two seconds:

1. Where am I?
2. What matters now?
3. What is the primary action?

Use:

- one dominant value or task per surface;
- whitespace to group related information;
- a restrained elevation system: canvas, instrument surface, secondary card, floating control, selected state;
- one branded primary action and quiet secondary actions;
- dense detail only after the primary story is clear;
- familiar controls, readable type, and explicit focus states.

Premium is precision and restraint. It is not neon glow, uniform card shadows, glass on every surface, excessive gradients, decorative 3D objects, or motion without comprehension value.

## 5. Build decision-grade analytics

Start with the user's question and the decision the chart enables. Then include:

- metric selector or a clearly named primary metric;
- time range and comparison window;
- dominant total and directional delta;
- chart type matched to the relationship: line for trend, bars for discrete volume, stacked bars for composition, donut only for a small whole, funnel for stage conversion;
- labelled axes and explicit units;
- legend mapping every series;
- exact current-period point or tooltip;
- data source, freshness, timezone, and attribution confidence where relevant;
- summary or breakdown table when operators need exact rows.

Use dual axes only when both series answer one decision together and their units are unmistakable. Never use random heights, ambiguous labels, decorative endpoints, or a chart that cannot be read without guessing.

On mobile, adapt rather than shrink:

- stack metric and period controls;
- maintain 44–48 pixel touch targets;
- move hover-only detail into a readable callout card;
- reduce visible labels or points deliberately;
- preserve units and the decision story;
- prevent document-level horizontal overflow.

## 6. Build the interactive proof

When a self-contained HTML artifact is requested:

- use repository brand tokens or CSS custom properties;
- make navigation, scope switching, setup steps, handoffs, and chart controls operate;
- use semantic elements, ARIA labels, keyboard paths, and visible focus states;
- include asset fallbacks so the artifact still communicates if a local image fails;
- keep prototype actions visibly non-production;
- avoid dependencies when plain HTML, CSS, SVG, and small JavaScript are sufficient.

Compose with `component-gen` for implementation patterns. Use existing component libraries first when they apply; build domain-specific analytics and workflow surfaces directly when generic components would weaken the product model.

## 7. Run six critique passes

Do not present the first render.

1. **Coverage** — routes, roles, states, and handoffs are complete.
2. **Hierarchy** — the eye reaches the primary value/task, trend/status, then action.
3. **Brand** — type, palette, voice, logo, icons, and density are source-backed.
4. **Premium restraint** — depth and motion establish hierarchy without decorating everything.
5. **Data truth** — charts have meaningful values, scales, units, labels, comparisons, exact detail, and provenance.
6. **Responsive proof** — desktop, tablet, and mobile remain readable and actionable.

Name what is wrong before editing. Remove rejected visual directions so stale variants do not survive in the artifact.

## 8. Verify the rendered result

Use `browser-test` or equivalent browser automation at minimum:

- desktop: 1440 × 900 or taller;
- tablet: 768 × 1024;
- mobile: 390 × 844 or the product's target device.

Verify:

- every in-scope route and major mode;
- onboarding and cross-screen handoffs;
- chart-control selected states;
- no console or page errors;
- no document-level horizontal overflow;
- readable text with no clipping or overlap;
- 44–48 pixel mobile touch targets;
- WCAG AA contrast for body and controls;
- reduced-motion behavior;
- screenshots captured after transitions settle.

Inspect every screenshot. A passing test suite does not overrule a visibly weak composition.

## Completion gate

The visual track is complete only when:

- the reference ledger cites inspected screens;
- the full route/role/state atlas exists;
- the interactive artifact uses the product's actual brand and business model;
- charts are decision-grade rather than placeholders;
- all six critique passes are recorded;
- desktop, tablet, mobile, interactions, errors, overflow, touch targets, contrast, and settled-state screenshots have observed proof;
- the boundary between prototype proof and production behavior is explicit.

## Anti-patterns

- Searching for “clean modern UI” and copying surface style without interaction anatomy.
- Polishing one dashboard while onboarding, settings, recovery, or role states remain undesigned.
- Filling whitespace with decorative cards that add no decision value.
- Making every card equally elevated.
- Using a graph with no question, units, comparison, exact value, or provenance.
- Showing fake controls that never change selected state.
- Compressing a desktop chart until mobile labels become unreadable.
- Capturing screenshots during page-entry opacity or drawer-overlay transitions.
- Declaring completion after formatting passes without visually inspecting the render.
