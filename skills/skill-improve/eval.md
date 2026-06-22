---
skill: skill-improve
---
# Eval: skill-improve

A failing-baseline eval — without the skill the agent rewrites prose cosmetically; with the skill
it audits against the skill standard and fixes what actually weakens triggering and quality.

## Baseline
Prompt the agent **without** the skill-improve skill loaded:

> "Improve this skill." (a skill whose `description` is a workflow summary, not a load signal,
> and whose body has no anti-patterns section)

Observed baseline failure: the agent tweaks wording and tightens a few sentences but leaves the
workflow-summary description (so agents still skip the body) and adds no missing sections. The
real defects — poor trigger signal, missing anti-patterns — remain.

## Pass
With the skill-improve skill loaded, the agent audits the skill against the standard (load-signal
description, progressive disclosure, anti-patterns, token budget) and fixes the structural gaps.

Pass criterion: the description is rewritten as a load signal ("does X; use when Y + symptoms")
and the missing standard sections are added. **Fail** if it only makes cosmetic edits and leaves
the workflow-summary description or missing sections in place.
