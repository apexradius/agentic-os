# Creator: how to add or change an agent

> The SOP for authoring a new agent or editing an existing one. Follow it top to bottom;
> the last step is an executable gate, not a vibe check. Read [`spec.md`](spec.md) and the
> body house style ([`../../prompting/agent-prompt.md`](../../prompting/agent-prompt.md))
> first.

## Decide the zone (first, because it's a one-way door)

- Is the role **generic** — would it make sense in any codebase (architect, critic,
  reviewer, executor)? → `framework/roles/<name>.md`. It must name no hostname, client,
  product, or person.
- Is it **Apex-specific** — does it know our systems, clients, or domain? →
  `apex/agents/<name>.md`. Concrete detail belongs here.

If you're unsure, default to `framework/roles/` and strip the specifics into
`<Core_Context>` patterns; the zone guard will tell you if you left coupling behind.

## Author the canonical `.md`

1. **Frontmatter.** `name` (kebab-case, == filename stem), a `description` that is a
   *load signal* ("does X; use when Y" — not a workflow recap), and `model`. Add
   `disallowedTools: Write, Edit` for any read-only/reviewer role (the read-only lane).
   Add `tools` / `mcpServers` / `skills` only if the role needs them. Stay inside the
   fields in `agents.schema.json` — unknown fields fail validation.
2. **Body.** One `<Agent_Prompt>` root. `<Role>` is required and must state what the agent
   does **and what it does not own** (the hand-off boundary). Then pick the shape:
   - reasoning/judgment role → add `<Constraints>`
   - operating role (does a job in a known system) → add `<Core_Context>` + `<Workflow>`
   Add `<Success_Criteria>`, `<Output_Format>`, `<Failure_Modes_To_Avoid>` as the role
   warrants. Write imperative, concrete, costed instructions. **No `"""` anywhere.**

## Build and verify (the gate)

Never hand-write the runtime copies — emit them, then prove it:

```bash
cd framework/primitives/_lib
node validate.mjs agents          # frontmatter (ajv) + body shape + zone guard
node emit.mjs                     # write .claude/agents/<name>.md + .codex/agents/<name>.toml
node emit.mjs --check             # confirm committed interfaces match canonical, no orphans
```

Then commit the canonical `.md` **and** the two emitted files together — they are one
logical change. A green `validate` + green `emit --check` is the definition of done.

## Editing an existing agent

Edit the **canonical** `.md` only. Re-run `emit` + `emit --check`. If `--check` reports
drift on a file you didn't mean to touch, someone hand-edited an emitted copy — reconcile
it back into the canonical source, never the other way.

## Renaming or deleting

- **Rename:** rename the canonical `.md` (and its `name` field together), re-emit, and
  delete the now-orphaned old `.claude/.md` + `.codex/.toml`. `emit --check` flags orphans.
- **Delete:** remove the canonical `.md` and both emitted files in the same commit.

## Reference implementations

Prior art worth reading (in other trees — referenced, not imported): the live agent
roster under `~/.claude/agents/` and `~/.codex/agents/`. This framework's `framework/roles/`
and `apex/agents/` are the canonical successors to those hand-maintained pairs.
