---
skill: qa
---
# Eval: qa

A failing-baseline eval — without the skill the agent clicks around and says it works; with the
skill it systematically finds, fixes, and verifies bugs with a health score.

## Baseline
Prompt the agent **without** the qa skill loaded:

> "QA this web app." (app has a form that submits on Enter without validation and a broken link
> in the footer)

Observed baseline failure: the agent loads the homepage, says "looks like it works fine," and
stops. No systematic path coverage; the validation gap and the broken link ship.

## Pass
With the qa skill loaded, the agent tests at the chosen tier (critical → medium → cosmetic),
reproduces each bug, fixes it, and verifies the fix, then reports a health score.

Pass criterion: the run finds the validation gap and the broken link, fixes them, shows
fix evidence (re-test), and reports a health score. **Fail** if it declares the app working
without systematic testing or fix verification.
