---
skill: vercel-react-best-practices
---
# Eval: vercel-react-best-practices

A failing-baseline eval — without the skill the agent writes React that ships the documented
anti-patterns; with the skill it applies the performance guidelines.

## Baseline
Prompt the agent **without** the vercel-react-best-practices skill loaded:

> "Build a product list page that fetches and filters items in this Next.js app."

Observed baseline failure: the agent fetches in a client component waterfall, recreates handlers
on every render, drops keys, and ignores server components / streaming — the exact patterns the
guidelines warn against. The page is slow and re-renders excessively.

## Pass
With the vercel-react-best-practices skill loaded, the agent applies the patterns: server
components / proper data fetching, memoization where it matters, stable keys, and avoids the
known re-render and bundle pitfalls.

Pass criterion: the implementation follows the performance guidelines (correct fetching boundary,
no needless re-renders, proper keys). **Fail** if it ships the documented anti-patterns (client
waterfall, unstable handlers, missing keys).
