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
With the notebook-to-skill skill loaded, the agent reads the notebook's sources through the live
`notebooklm-mcp` server (not pasted text), picks the extraction method by corpus size
(`source_get_content` for a faithful single creator, `notebook_query` for a large multi-creator
corpus), and distills the findings, rules, and procedures into a structured `SKILL.md` (load-signal
description, decision-complete procedure) with `references/` whose claims carry `(<source-id>)`
citations and a sibling `eval.md`.

Pass criterion: the output is a validator-passing, source-cited skill built from live MCP reads, not
a pasted notebook. **Fail** if it pastes/transcribes prose, invents uncited rules, or ships no eval.
