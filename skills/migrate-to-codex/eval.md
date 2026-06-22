---
skill: migrate-to-codex
---
# Eval: migrate-to-codex

A failing-baseline eval — without the skill the agent copies files to guessed locations; with the
skill it migrates each supported artifact type into its correct Codex project/global file.

## Baseline
Prompt the agent **without** the migrate-to-codex skill loaded:

> "Migrate our Claude setup over to Codex."

Observed baseline failure: the agent copies a couple of files to arbitrary paths, mishandles the
instruction-file mapping, and skips skills/agents/MCP config — leaving Codex partly configured and
some artifacts in the wrong place.

## Pass
With the migrate-to-codex skill loaded, the agent migrates the supported artifacts (instruction
files, skills, agents, MCP config) into the correct Codex project and global locations.

Pass criterion: each supported artifact type lands in its correct Codex destination, with the
instruction-file mapping handled. **Fail** if it copies files to guessed paths or omits supported
artifact types.
