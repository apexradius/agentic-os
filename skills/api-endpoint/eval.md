---
skill: api-endpoint
---
# Eval: api-endpoint

A failing-baseline eval — without the skill the agent ships a happy-path handler; with the skill
it validates input, enforces auth, and handles errors.

## Baseline
Prompt the agent **without** the api-endpoint skill loaded:

> "Add a POST endpoint to create an order."

Observed baseline failure: the agent writes a handler that trusts the request body, runs no
validation, has no auth check on the protected route, and returns a 500 stack trace on bad
input. Insecure and brittle.

## Pass
With the api-endpoint skill loaded, the agent adds input validation, an auth check on the
protected route, typed request/response, structured error responses, and rate limiting.

Pass criterion: invalid input is rejected with a structured 4xx (not a 500), the route enforces
auth, and types are defined. **Fail** if the endpoint trusts unvalidated input or skips the auth
check on a protected route.
