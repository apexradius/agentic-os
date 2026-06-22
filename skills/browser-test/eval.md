---
skill: browser-test
---
# Eval: browser-test

A failing-baseline eval — without the skill the agent reasons about the UI from the source; with
the skill it drives a real browser and observes the rendered result.

## Baseline
Prompt the agent **without** the browser-test skill loaded:

> "Check that the new pricing page renders correctly on mobile."

Observed baseline failure: the agent reads the CSS/markup and concludes "it should be responsive
and look fine" — an inference from source, never loading the page. A real overflow or broken
layout at mobile width goes unseen.

## Pass
With the browser-test skill loaded, the agent navigates to the page in a real browser, sets the
mobile viewport, takes a screenshot, and inspects the actual rendering.

Pass criterion: the verdict is backed by an observed render (screenshot / DOM at the target
viewport), not source inference. **Fail** if "it should render fine" is asserted without loading
the page.
