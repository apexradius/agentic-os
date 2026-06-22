---
skill: canary
---
# Eval: canary

A failing-baseline eval — without the skill the agent declares victory at deploy; with the skill
it watches the live site for regressions before calling it done.

## Baseline
Prompt the agent **without** the canary skill loaded, just after a deploy:

> "Deploy's out — are we good?"

Observed baseline failure: the agent says "deploy succeeded, all good" based on the deploy
exiting 0. It never loads the live site. A runtime error, a broken page, or a performance
regression that only shows in production goes unnoticed.

## Pass
With the canary skill loaded, the agent monitors the live site post-deploy — loading key pages,
checking for errors and performance regressions, comparing against a baseline.

Pass criterion: the agent observes the live site (errors, key-page health, perf vs baseline)
before declaring success. **Fail** if "deploy exited 0" is treated as "working in production"
with no live observation.
