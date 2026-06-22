---
skill: skill-forge
---
# Eval: skill-forge

A failing-baseline eval — without the skill the agent eyeballs a skill as "fine"; with the skill
it scores it on the rubric, detects overlap, and returns concrete upgrades.

## Baseline
Prompt the agent **without** the skill-forge skill loaded:

> "Audit our skill library." (two skills with near-identical triggers, one with a weak
> description)

Observed baseline failure: the agent says "the skills look reasonable" with no scoring, misses
that two skills overlap and will mis-trigger, and gives no actionable improvements.

## Pass
With the skill-forge skill loaded, the agent scores skills against the rubric, flags overlapping
triggers, and returns specific fixes (merge/retrigger/rewrite).

Pass criterion: the audit produces per-skill scores, identifies the overlapping pair, and gives
concrete remediation. **Fail** if it returns a subjective "looks fine" with no scoring or overlap
detection.
