---
skill: learn
---
# Eval: learn

A failing-baseline eval — without the skill the agent skims a couple of files and guesses; with
the skill it extracts the codebase's real patterns and conventions into a knowledge base.

## Baseline
Prompt the agent **without** the learn skill loaded:

> "Get up to speed on this codebase."

Observed baseline failure: the agent opens the README and a file or two and reports generic
impressions ("it's a Node app with an Express server"). It misses the project's actual
conventions — error-handling pattern, naming, layering, test style — and writes nothing durable.

## Pass
With the learn skill loaded, the agent analyzes the codebase and extracts patterns, conventions,
and architecture decisions into a durable knowledge base for the project.

Pass criterion: the output captures the project's real conventions (with file evidence) and
persists them, not surface impressions. **Fail** if it returns a generic summary or leaves
nothing reusable behind.
