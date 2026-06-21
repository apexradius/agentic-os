# Primitive: Commands

> A slash command is a reusable prompt the user invokes by name (`/reflect`, `/apex-review`).
> It is the thinnest primitive: frontmatter + a prompt body, usually dispatching to an agent
> or skill. This spec is the contract. Schema: [`commands.schema.json`](commands.schema.json).
> Validator: [`validate.mjs`](validate.mjs). Creator: [`creator.md`](creator.md).

## The shape of a command

A command is one Markdown file under `.claude/commands/`: YAML **frontmatter** (what it is) +
a **prompt body** (what it does). The command name is the **filename stem** — there is no
`name` field.

```markdown
---
description: Dispatch apex-client-ops for proposals/contracts/estimates/onboarding
argument-hint: [client-and-ask]
allowed-tools: Read, Edit, Bash
---

Use the `apex-client-ops` subagent for: $ARGUMENTS
```

`description` is the only required field (the picker help text). `argument-hint` documents the
`$ARGUMENTS` the body consumes. `allowed-tools` scopes what the body may call. All bounded by
[`commands.schema.json`](commands.schema.json).

## Claude-only — no emit, no Codex projection

Unlike agents, a command is **not** single-sourced into two runtimes. Codex has **no native
slash-command dispatch** — it uses agents and skills instead. So a command lives only in
`.claude/commands/` and there is **no `emit.mjs`** for this primitive. Commands are also
**instance-level**: they dispatch to specific agents/skills, so there is no generic
`framework/` zone for them and therefore **no coupling guard** (that guard exists only for
generic `framework/roles/` agents).

## Validation: two honest layers

`validate.mjs` checks a command in two layers:

1. **Frontmatter** → `ajv` against `commands.schema.json`. `description` required;
   `argument-hint` is string **or** list; unknown keys fail (`additionalProperties: false`).
2. **Body** → code, because the prompt is freeform Markdown: it must be **non-empty** (a
   command with no body does nothing). A body that consumes `$ARGUMENTS` without declaring an
   `argument-hint` is a **warning**, not an error.

Because no commands are ported into this framework repo yet, the validator carries an inline
`--selftest` (accept-good + reject-bad) so `node _lib/validate.mjs --all` stays non-vacuous on
a fresh clone. Verified against the live set: all 21 `~/.claude/commands/*.md` pass.

## Constraints (what NOT to do)

- **Never add a `name` field.** The filename is the name; a `name` key fails validation.
- **Never leave the body empty.** A command is a prompt — write the prompt.
- **Keep `description` a one-liner.** It is picker help, not documentation.
- **Don't reach for Codex parity.** Commands are Claude-only by design; if Codex needs the
  same capability, express it as an agent or skill.

## Verify (executable acceptance)

```
node framework/primitives/commands/validate.mjs --selftest          # inline good/bad proof
node framework/primitives/commands/validate.mjs ~/.claude/commands/*.md   # real artifacts
```
Green = the command set conforms.
