---
skill: audit
---
# Eval: audit

A failing-baseline eval — without the skill the agent eyeballs a site and says "looks fine";
with the skill it runs the tiered checks and returns a scored, prioritized report.

## Baseline
Prompt the agent **without** the audit skill loaded:

> "Audit this website." (a site with a missing meta description, a 4 MB hero image, and an
> unlabeled form input)

Observed baseline failure: the agent loads the page, says it "looks clean and professional,"
and gives a few generic opinions. No systematic checks; the real SEO/performance/accessibility
defects go unfound and unscored.

## Pass
With the audit skill loaded, the agent runs the audit dimensions at the chosen tier (SEO,
performance, accessibility, CRO, etc.) and produces a scored report.

Pass criterion: the report catches the planted defects (missing meta, oversized image,
unlabeled input), assigns a score, and ranks fixes by impact. **Fail** if it returns a
subjective "looks fine" without per-dimension checks and a score.
