---
skill: notebook-to-skill
---
# Eval: notebook-to-skill

A failing-baseline eval — without the skill the agent dumps notebook text into a markdown file; with
the skill it distills the research into a spec-conformant skill.

## Baseline
Prompt the agent **without** the notebook-to-skill skill loaded:

> "Turn this NotebookLM research into a skill."

Observed baseline failure: the agent pastes the notebook's prose into a `SKILL.md` with no
load-signal description, no extracted procedure/rules, and no eval — a research dump, not a skill.
It won't trigger reliably and won't pass the skills validator.

## Pass
With the notebook-to-skill skill loaded, the agent extracts the findings, rules, and procedures into
a structured `SKILL.md` (load-signal description, procedure body) with a sibling `eval.md`.

Pass criterion: the output is a validator-passing skill (real load-signal description + procedure +
eval), not a pasted notebook. **Fail** if it dumps the research as prose with no skill structure or
eval.
