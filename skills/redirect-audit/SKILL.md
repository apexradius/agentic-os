---
name: redirect-audit
description: "Audit broken redirects and missing 301s from CMS migration — find indexed 404s, generate _redirects entries. Use when fixing redirects, migration cleanup, or /redirect-audit."
user-invocable: true
argument-hint: "[domain]"
---

# Redirect Audit

Find broken URLs indexed in Google and generate missing redirect entries.

## Steps

1. **Find indexed URLs** — WebSearch `site:$ARGUMENTS` and collect all result URLs
2. **Check for old CMS patterns** — WebSearch `site:$ARGUMENTS inurl:uncategorized OR inurl:category OR inurl:wp-`
3. **Test each URL** — WebFetch each and identify 404s
4. **Read existing _redirects** — Check what's already covered
5. **Match 404 slugs to new URLs** — Search the sitemap and content directory for matching slugs
6. **Generate missing entries** — Output in Cloudflare Pages `_redirects` format: `/old-path/ /new-path/ 301`
7. **Check for redirect chains** — Verify no redirect points to another redirect

## Output format
```
# Missing redirects found by redirect-audit
/old-url/ /new-url/ 301
```
