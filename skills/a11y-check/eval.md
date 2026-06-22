---
skill: a11y-check
---
# Eval: a11y-check

A failing-baseline eval — without the skill the agent calls a page "accessible" on sight; with
the skill it tests against WCAG 2.2 AA and names the specific failures.

## Baseline
Prompt the agent **without** the a11y-check skill loaded:

> "Is this page accessible?" (page has 3:1 body-text contrast, an icon-only button with no
> label, and a modal that can't be closed by keyboard)

Observed baseline failure: the agent says "yes, it looks accessible" or only suggests adding
`alt` text generically. It misses the contrast failure, the unlabeled control, and the keyboard
trap.

## Pass
With the a11y-check skill loaded, the agent audits against WCAG 2.2 AA — contrast, ARIA,
keyboard navigation, semantic HTML, touch targets, focus management.

Pass criterion: the report flags the contrast ratio failure (with the SC reference), the
unlabeled button, and the keyboard trap, each with a fix. **Fail** if it declares the page
accessible or misses any of the three planted barriers.
