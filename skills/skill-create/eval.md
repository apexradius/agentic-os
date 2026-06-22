---
skill: skill-create
---
# Eval: skill-create

A failing-baseline eval — without the skill the agent writes a loose markdown file; with the
skill it produces a spec-conformant skill that passes the validator, eval included.

## Baseline
Prompt the agent **without** the skill-create skill loaded:

> "Create a new skill for generating release notes."

Observed baseline failure: the agent writes a `SKILL.md` with a workflow-summary description
(so agents skip the body), no `eval.md`, and a name that doesn't match its directory. It would
warn or fail the skills validator and won't trigger reliably.

## Pass
With the skill-create skill loaded, the agent scaffolds `<name>/SKILL.md` with a load-signal
description, name == directory, progressive-disclosure body, and a sibling `eval.md`, then runs
the validator.

Pass criterion: the new skill passes `validate.mjs` clean (load-signal description, valid
frontmatter, and a well-formed eval). **Fail** if it produces a workflow-summary description, a
name/dir mismatch, or no eval.
