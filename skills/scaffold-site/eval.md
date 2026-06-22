---
skill: scaffold-site
---
# Eval: scaffold-site

A failing-baseline eval — without the skill the agent drops generic boilerplate; with the skill it
scaffolds a structured site with the project's conventions and the right baseline pages/config.

## Baseline
Prompt the agent **without** the scaffold-site skill loaded:

> "Scaffold a new marketing site for this project."

Observed baseline failure: the agent runs a bare framework init and leaves it — no design tokens,
no SEO baseline (meta, sitemap, robots), no page structure, no content scaffolding. A blank starter
that needs everything redone.

## Pass
With the scaffold-site skill loaded, the agent scaffolds the site with a sensible page structure,
design-token foundation, and SEO baseline (meta, sitemap, robots) wired in.

Pass criterion: the scaffold includes structured pages, a token/design foundation, and SEO basics
— not a bare init. **Fail** if it produces empty boilerplate with no structure or SEO baseline.
