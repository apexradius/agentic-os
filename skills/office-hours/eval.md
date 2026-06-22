---
skill: office-hours
---
# Eval: office-hours

A failing-baseline eval — without the skill the agent validates an idea by agreeing with it; with
the skill it stress-tests assumptions YC-style and surfaces the real risk.

## Baseline
Prompt the agent **without** the office-hours skill loaded:

> "I want to build a marketplace for X — talk it through with me."

Observed baseline failure: the agent is an encouraging yes-man ("great idea, here's how to build
it"), never challenging the riskiest assumption (demand, chicken-and-egg supply, willingness to
pay). The founder leaves with false confidence.

## Pass
With the office-hours skill loaded, the agent runs the appropriate mode (startup validation or
builder design-thinking), names the load-bearing assumptions, and stress-tests the weakest one.

Pass criterion: the session identifies and challenges the riskiest assumption with a concrete
validation test, rather than endorsing the idea. **Fail** if it affirms the idea without
stress-testing any core assumption.
