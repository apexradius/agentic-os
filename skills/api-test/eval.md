---
skill: api-test
---
# Eval: api-test

A failing-baseline eval — without the skill the agent checks one 200 and calls it tested; with
the skill it exercises CRUD, auth, and error paths.

## Baseline
Prompt the agent **without** the api-test skill loaded:

> "Test this API."

Observed baseline failure: the agent hits the health endpoint, sees 200, and reports the API
"working." No CRUD coverage, no auth-failure case, no malformed-input case — most real failure
modes are never triggered.

## Pass
With the api-test skill loaded, the agent tests health, CRUD operations, auth flows (including
rejection of unauthenticated requests), and error handling, then reports results.

Pass criterion: the run covers CRUD + an auth-failure case + an invalid-input case with observed
status/response per check. **Fail** if a single 200 stands in for testing or auth/error paths are
untested.
