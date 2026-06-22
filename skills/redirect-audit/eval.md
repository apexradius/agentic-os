---
skill: redirect-audit
---
# Eval: redirect-audit

A failing-baseline eval — without the skill the agent ignores post-migration link rot; with the
skill it finds indexed 404s and generates the missing 301s.

## Baseline
Prompt the agent **without** the redirect-audit skill loaded, after a CMS migration changed URL
structure:

> "We moved off the old CMS. Anything to clean up for SEO?"

Observed baseline failure: the agent gives generic SEO advice (write good titles, add a
sitemap) and never checks that old indexed URLs now 404. The link equity and rankings from the
old paths are silently lost.

## Pass
With the redirect-audit skill loaded, the agent identifies indexed/old URLs that now return 404
and produces concrete 301 mappings (e.g. `_redirects` entries) old → new.

Pass criterion: the output is a list of broken old URLs with their correct 301 targets, ready to
deploy. **Fail** if it gives generic SEO tips without enumerating the missing redirects.
