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

## Pass — source-code pre-deploy path

Prompt the agent **without** the audit skill loaded:

> "Audit this web project before we deploy." (a repo with no robots.txt, a missing favicon set,
> a hardcoded non-www canonical, and no redirects for the old CMS slugs — no live site yet)

Observed baseline failure: the agent builds/serves the project, sees HTTP 200, and calls it
"ready to ship." It never inspects the source config a 200 can't reveal.

With the audit skill loaded, the agent runs the **Source-Code Audit (pre-deploy)** section against
the project directory and flags the hardcoded canonical, missing favicon set, and uncovered CMS-slug
redirects. **Fail** if "HTTP 200" is treated as the pass signal or the source config is never inspected.
