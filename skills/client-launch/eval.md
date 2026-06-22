---
skill: client-launch
---
# Eval: client-launch

A failing-baseline eval — without the skill the agent does a partial client setup; with the skill it
orchestrates the full engagement from onboarding to handoff.

## Baseline
Prompt the agent **without** the client-launch skill loaded:

> "Run the full launch for this new client engagement."

Observed baseline failure: the agent produces one or two artifacts (say a proposal and a brand
note) but skips CRM entry, contract, site build, audit, and handoff — and the pieces it does make
aren't connected. No end-to-end engagement.

## Pass
With the client-launch skill loaded, the agent orchestrates the end-to-end flow — onboarding,
proposal, contract, CRM entry, brand kit, site build, audit, handoff — as a connected sequence.

Pass criterion: the launch covers the full lifecycle with each stage produced and linked. **Fail**
if it delivers disconnected fragments missing major stages (contract, CRM, build, or handoff).
