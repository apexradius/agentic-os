---
skill: onboard-dev
---
# Eval: onboard-dev

A failing-baseline eval — without the skill the agent hand-waves "read the README"; with the
skill it produces a working dev environment and a real first-contribution path.

## Baseline
Prompt the agent **without** the onboard-dev skill loaded:

> "Onboard a new developer to this repo."

Observed baseline failure: the agent says "clone it, run npm install, read the docs" — generic
advice that ignores this repo's actual setup steps, required env vars, and where a newcomer
should make their first change. The dev hits undocumented setup walls.

## Pass
With the onboard-dev skill loaded, the agent maps the architecture, lays out concrete dev-env
setup (real dependencies, env vars, run/test commands for this repo), and points to a scoped
first contribution.

Pass criterion: the onboarding reflects this repo's actual setup and names a specific
first-task entry point. **Fail** if it gives generic clone-and-install advice with no repo-specific
setup or first-contribution guidance.
