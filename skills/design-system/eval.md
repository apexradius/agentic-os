---
skill: design-system
---
# Eval: design-system

A failing-baseline eval — without the skill the agent scatters one-off styles; with the skill it
defines tokens and reusable patterns as a single source of truth.

## Baseline
Prompt the agent **without** the design-system skill loaded:

> "Set up the styling foundation for this app."

Observed baseline failure: the agent hardcodes colors, spacing, and font sizes inline per
component (`#3b82f6` here, `16px` there). No tokens, no scale — every later change means
find-and-replace, and the UI drifts inconsistent.

## Pass
With the design-system skill loaded, the agent defines design tokens (color, type scale,
spacing) as CSS custom properties / a token source and documents the component patterns that
consume them.

Pass criterion: styling references named tokens from one source (not scattered literals) and
usage guidelines exist. **Fail** if values are hardcoded per component with no token layer.
