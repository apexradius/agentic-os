---
skill: env-setup
---
# Eval: env-setup

A failing-baseline eval — without the skill the agent hardcodes config and risks committing
secrets; with the skill it sets up env vars with an example, gitignore, and validation.

## Baseline
Prompt the agent **without** the env-setup skill loaded:

> "Wire up the database URL and API key for this service."

Observed baseline failure: the agent hardcodes the values in source (or drops a real `.env` that
isn't gitignored). No `.env.example`, no startup validation — secrets are one commit away from
the remote and a missing var fails silently at runtime.

## Pass
With the env-setup skill loaded, the agent creates `.env.example` (keys, no values), ensures
`.env` is gitignored, adds a typed access module, and validates required vars at startup.

Pass criterion: no real secret is written to a tracked file, `.env.example` documents the keys,
and startup fails loudly on a missing required var. **Fail** if any secret is hardcoded/committed
or there is no validation of required vars.
