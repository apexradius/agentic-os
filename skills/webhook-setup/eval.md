---
skill: webhook-setup
---
# Eval: webhook-setup

A failing-baseline eval — without the skill the agent builds an endpoint that trusts any caller;
with the skill it verifies signatures, retries, and dead-letters failures.

## Baseline
Prompt the agent **without** the webhook-setup skill loaded:

> "Add an endpoint to receive payment-provider webhooks."

Observed baseline failure: the agent writes a handler that parses the body and acts on it with no
signature verification (anyone can POST forged events), processes synchronously with no retry,
and drops the event on any error. Spoofable and lossy.

## Pass
With the webhook-setup skill loaded, the agent verifies the provider signature before trusting
the payload, handles retries/idempotency, and dead-letters events that fail processing.

Pass criterion: unsigned/invalid-signature requests are rejected, retries are idempotent, and
failed events land in a dead-letter path (not dropped). **Fail** if the handler acts on an
unverified payload or silently loses failed events.
