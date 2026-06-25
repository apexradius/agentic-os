# framework/roles — generic agent definitions

Source-of-truth role definitions (discipline specialists + design-critic). A build step emits native `.claude/*.md` and `.codex/*.toml` from these.

Each role is a validated artifact, **not** loose prose: [`../primitives/agents/validate.mjs`](../primitives/agents/validate.mjs) scans this directory, checks every role against [`agents.schema.json`](../primitives/agents/agents.schema.json) (frontmatter + `<Agent_Prompt>` body), and enforces a zone-purity guard — a `framework/roles/` definition must carry zero instance coupling. Roles are the *source* for the `agents` primitive, so they are covered by that primitive's gate and run under `validate.mjs --all`.
