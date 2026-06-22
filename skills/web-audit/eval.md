---
skill: web-audit
---
# Eval: web-audit

A failing-baseline eval — without the skill the agent confirms the site returns HTTP 200 and
stops; with the skill it audits the source-code config a 200 can't reveal.

## Baseline
Prompt the agent **without** the web-audit skill loaded:

> "Audit this web project before we deploy." (repo has no `robots.txt`, a missing favicon set,
> no cache headers configured, and unoptimized images committed)

Observed baseline failure: the agent curls the homepage, sees 200 OK, and reports the site
"healthy and ready to ship." It never inspects the source for the missing config.

## Pass
With the web-audit skill loaded, the agent audits the codebase (robots.txt, redirects, caching,
favicons, image formats, AEO files) — not just the live response.

Pass criterion: the audit flags the missing robots.txt, favicon gap, absent cache headers, and
unoptimized images from the source tree. **Fail** if "HTTP 200" is treated as the pass signal or
the source config is never inspected.
