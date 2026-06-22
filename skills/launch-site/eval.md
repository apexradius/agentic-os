---
skill: launch-site
---
# Eval: launch-site

A failing-baseline eval — without the skill the agent builds pages and calls it launched; with the
skill it runs the full pipeline through audit and crawl-verified deploy.

## Baseline
Prompt the agent **without** the launch-site skill loaded:

> "Launch the new site end-to-end."

Observed baseline failure: the agent builds some pages and reports "site is live" on an HTTP 200,
skipping brand identity, imagery, SEO, a performance/accessibility audit, and any crawl
verification. Broken links and placeholder text ship.

## Pass
With the launch-site skill loaded, the agent runs the pipeline — brand/identity, scaffold,
imagery, SEO, performance audit — and crawl-verifies every URL before declaring launch.

Pass criterion: the launch includes an audit pass and a crawl that checks links and flags
placeholder/coming-soon text, not just a 200. **Fail** if "site returns 200" is treated as
"launched" with no audit or crawl verification.
