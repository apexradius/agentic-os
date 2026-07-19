# Primitive: Agents

> A sub-agent is a single role with its own context window, tools, and prompt, dispatched
> to do one job and return. This spec is the contract for how agents are defined and built
> in this framework. Schema: [`agents.schema.json`](agents.schema.json). Validator:
> [`validate.mjs`](validate.mjs). Creator: [`creator.md`](creator.md). Body house style:
> [`../../prompting/agent-prompt.md`](../../prompting/agent-prompt.md).

## The shape of an agent

An agent is one Markdown file: YAML **frontmatter** (what it is) + an `<Agent_Prompt>`
**body** (how it thinks).

```markdown
---
name: architect            # kebab-case; == filename stem == emitted .toml name
description: …              # load signal: what it does + when to use it
model: claude-opus-4-8      # Claude model id (Claude-only)
disallowedTools: Write, Edit
---

<Agent_Prompt>
  <Role>…</Role>
  …
</Agent_Prompt>
```

Frontmatter fields are defined and bounded by `agents.schema.json`. The two that matter
most: `name` (the identity, must match the filename) and `description` (the load signal —
written as "does X; use when Y", never a workflow summary). `disallowedTools` is the
**read-only-lane** mechanism: an analyst/reviewer role lists `Write, Edit` here so it
physically cannot mutate the tree.

### Optional runtime contract

An agent may declare `runtime_contract` when a runtime needs machine-readable I/O
boundaries:

```yaml
runtime_contract:
  input_schema: schemas/review-input.schema.json
  output_schema: schemas/review-output.schema.json
  tool_param_schemas:
    web_search: schemas/web-search-params.schema.json
  retry_limit: 2
  handoff_targets:
    - verifier
runtime_contract_examples:
  valid_inputs:
    - artifact: reports/review.json
  invalid_inputs:
    - artifact: ""
  valid_outputs:
    - verdict: pass
  invalid_tool_params:
    web_search:
      - query: ""
```

The primitive validator checks this block structurally only. It accepts schema pointers
or inline schema objects, bounds `retry_limit`, and requires handoff targets to be
kebab-case. `runtime_contract_examples` is optional, but if present it must be attached
to a `runtime_contract` and must contain non-empty example lists/maps. Runtime enforcement,
retry behavior, and tool-parameter validation remain instance-owned.

## Single source, two runtimes (the build)

An agent is authored **once** as a canonical `.md`, and emitted to both runtime
interfaces. There is no second hand-maintained copy — that duplication is the failure
this primitive exists to kill.

```
  CANONICAL (edit here)                 EMITTED (never edit; committed + drift-checked)
  framework/roles/<name>.md   ──────▶   .claude/agents/<name>.md     (byte copy)
  apex/agents/<name>.md       ──┐  └──▶  .codex/agents/<name>.toml    (projection)
                                │
        generic, zero coupling ─┘ Apex-specific
```

- **`framework/roles/`** holds generic roles (architect, critic, executor…). Zero Apex
  coupling — the validator greps for it and fails the build if found.
- **`apex/agents/`** holds Apex-specific agents (apex-*). Concrete instance detail
  (systems, hosts, pipelines) lives here and is an asset, not coupling-to-remove.
- The emit is **one-directional** and run by
  [`../_lib/emit.mjs`](../_lib/emit.mjs): `node emit.mjs` writes the interfaces;
  `node emit.mjs --check` fails CI if a committed interface drifts from canonical, or if
  an emitted file has no canonical source (orphan).

### The Codex projection is intentionally lossy

`.codex/agents/<name>.toml` is a **3-key** file: `name`, `description`, and
`developer_instructions` (the body). Every other frontmatter field —
`model`, `tools`, `skills`, `mcpServers`, `memory`, `level`, `color`, `disallowedTools` —
is **Claude-only and intentionally dropped**. Codex consumes a 3-key agent; this is by
design, not a bug. The body is embedded verbatim in a TOML multi-line basic string
(`"""…"""`); a literal `"""` in a body is rejected by the emitter rather than silently
producing invalid TOML.

## Validation: two honest layers

`validate.mjs` checks an agent in two separable layers, because they need different tools:

1. **Frontmatter** → `ajv` against `agents.schema.json`. Structured, machine-checkable.
   This includes the optional `runtime_contract` and `runtime_contract_examples` blocks
   when present.
2. **Body** → code, because XML is not JSON. The rules (see the house style):
   - wrapped in `<Agent_Prompt>…</Agent_Prompt>`
   - contains the required `<Role>`
   - satisfies **one** body shape: `<Constraints>` (reasoning roles) **or**
     `<Core_Context>` + `<Workflow>` (operating roles)
   - contains no `"""` (would break the Codex emit)

Plus a **zone guard**: any file under `framework/roles/` containing instance coupling (a
hostname, client, product, or an operator's name) fails. A missing `model` is a *warning*, not an
error — a role may legitimately inherit the session default.

## Constraints (what NOT to do)

- **Never edit `.claude/agents/*` or `.codex/agents/*` by hand.** They are emitted. Edit
  the canonical `.md` and re-run emit.
- **Never let the two runtimes diverge** by patching one interface. Reconcile in the
  canonical source.
- **Never put Apex specifics in `framework/roles/`.** If a generic role needs to name its
  runtime, say it neutrally (the validator enforces this).
- **Never hand-author the `.toml`.** It is a projection, not a source.
- **Never inline a skill's content into `<Core_Context>` when wiring it.** One line per wired
  skill: what it is + when to load it. The depth (workflow, numbers, caveats) lives in the
  skill's own `SKILL.md`/references — duplicating it bloats every session the agent runs and
  drifts the moment the skill is revised.

## Verify (executable acceptance)

```
node framework/primitives/_lib/validate.mjs agents   # frontmatter + body + zone
node framework/primitives/_lib/emit.mjs --check       # interfaces match canonical, no orphans
```
Both green = the agent set conforms.
