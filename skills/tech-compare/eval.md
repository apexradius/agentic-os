---
skill: tech-compare
---
# Eval: tech-compare

A failing-baseline eval — without the skill the agent picks the popular/familiar option; with
the skill it compares on consistent dimensions and recommends for *this* context.

## Baseline
Prompt the agent **without** the tech-compare skill loaded:

> "Should we use framework A or framework B for this service?"

Observed baseline failure: the agent says "go with A, it's the industry standard / what I know
best." No side-by-side on features, performance, pricing, or fit — a popularity vote, not a
comparison.

## Pass
With the tech-compare skill loaded, the agent compares the options across consistent dimensions
(features, performance, pricing, ecosystem, fit-to-requirements) and recommends one for the
stated context.

Pass criterion: a dimensional comparison with a recommendation tied to the project's actual
constraints — not "it's popular." **Fail** if the choice rests on familiarity/popularity with no
dimensional analysis.
