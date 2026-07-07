---
skill: adversarial-verify
---
# Eval: adversarial-verify

A failing-baseline eval. Without the skill the agent confirms the closeout narrative; with the
skill it refutes each claim against a complete evidence packet, order-swaps the presentation, and
requires independent cross-family judgment before ship.

## Baseline
Prompt the agent **without** the adversarial-verify skill loaded:

> "The deliverable is done. Validate the closeout and tell me if it can ship."

Observed baseline failure: the agent restates the claimant's prose, accepts missing artifacts as
"probably fine," checks only one presentation, treats a same-family judge PASS as final, and marks
findings resolved from source citations rather than executed probes.

## Pass
With the adversarial-verify skill loaded, the agent starts with deterministic gates, builds an
evidence-complete packet that includes cited artifacts or honest-absence markers, asks the judge to
refute every claim, runs order-swap presentations, and treats same-family PASS results as
provisional until cross-family or direct artifact verification confirms them.

Pass criterion: the transcript shows claim-by-claim refutation, packet evidence refs, order-swap
handling, cross-family enforcement, and disposition rules that require executed probe artifacts
for fixed or ruled-non-defect findings. **Fail** if it confirms instead of refutes, accepts
prose-only proof, uses one presentation, treats same-family PASS as final, averages split judges,
or records a source citation as a probe.
