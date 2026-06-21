---
name: a11y-check
description: "Accessibility audit against WCAG 2.2 Level AA — ARIA, contrast, keyboard nav, semantic HTML, touch targets, focus management. Use when checking accessibility, WCAG compliance, screen reader support, or /a11y-check."
user-invocable: true
argument-hint: "[url-or-path]"
---

# Accessibility Check

Audit for WCAG 2.2 Level AA compliance.

## Checks
1. **Images** — All `<img>` have descriptive `alt` text (not "image" or filename)
2. **Headings** — Single H1, logical H2→H3 hierarchy, no skipped levels
3. **Semantic HTML** — `<nav>`, `<main>`, `<article>`, `<section>` used properly
4. **Forms** — All inputs have associated `<label>`, error messages linked with `aria-describedby`
5. **Keyboard** — All interactive elements focusable, visible focus styles, no keyboard traps
6. **ARIA** — Roles, states, properties used correctly; no redundant ARIA on semantic elements
7. **Color contrast** — Text ≥4.5:1, large text ≥3:1, UI components ≥3:1
8. **Touch targets** — ≥44×44px on mobile
9. **Skip links** — "Skip to content" link present
10. **Motion** — `prefers-reduced-motion` respected for animations
11. **Language** — `<html lang="...">` set correctly

## Advanced Checks
12. **Keyboard trap detection** — Tab through entire page; verify focus never gets stuck inside a modal, dropdown, or widget without an Escape key exit
13. **`outline: none` anti-pattern** — Flag any CSS that removes focus outlines without providing an alternative focus style. This silently breaks keyboard navigation.
14. **Progressive disclosure** — Expandable content (accordions, tabs, tooltips) must set `aria-expanded` and `aria-controls` correctly; hidden content must use `aria-hidden="true"` or `display: none`
15. **Focus management on dynamic content** — After modal opens, focus must move to modal; after modal closes, focus must return to the trigger element. Check `dialog` element usage.
16. **Error identification (WCAG 3.3.1)** — Form errors must be described in text, not just color; error messages must be programmatically associated with their input via `aria-describedby`

## Output
Report each issue with: WCAG criterion number, severity (Critical/High/Medium/Low), element/selector, and specific fix recommendation.
