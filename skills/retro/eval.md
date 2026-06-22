---
skill: retro
---
# Eval: retro

A failing-baseline eval — without the skill the agent gives a feel-good wrap-up; with the skill it
runs a grounded retrospective with concrete changes to make.

## Baseline
Prompt the agent **without** the retro skill loaded, after a project phase:

> "Let's do a retro on this phase."

Observed baseline failure: the agent says "good work, a few things could be smoother" — no
analysis of git history, issues, or session logs, and no concrete what-to-change. Nothing
improves next phase.

## Pass
With the retro skill loaded, the agent analyzes the phase's git history, issues, and logs and
produces what-went-well / what-didn't / what-to-change with specific actions.

Pass criterion: the retro is grounded in actual phase data and yields concrete, actionable
changes. **Fail** if it returns generic positives with no evidence or action items.
