# Creator: how to add or change a command

> The SOP for authoring a new slash command. Read [`spec.md`](spec.md) first. The last step
> is an executable gate, not a vibe check.

## Author the command file

1. **Pick the name.** The filename stem *is* the command — `apex-review.md` → `/apex-review`.
   Use kebab-case. There is no `name` frontmatter field.
2. **Frontmatter.** A `description` is required — write it as picker help ("does X"), one
   line. Add `argument-hint` if the body reads `$ARGUMENTS` (a string like `[pr-number]` or a
   list like `[client, ask]`). Add `allowed-tools` to scope the run. Stay inside the fields in
   `commands.schema.json` — unknown fields fail validation.
3. **Body.** Write the prompt. The dominant pattern is a thin dispatch:
   `Use the \`<agent>\` subagent for: $ARGUMENTS`, optionally followed by what to return.
   Heavier commands carry a full procedure in the body. Either way the body must be non-empty.

## Verify (the gate)

```bash
node framework/primitives/commands/validate.mjs .claude/commands/<name>.md
node framework/primitives/commands/validate.mjs --selftest
```

A green `validate` is the definition of done. Commit the single `.md` — there is no emitted
copy and no Codex projection (commands are Claude-only; see `spec.md`).

## Editing, renaming, deleting

- **Edit:** change the file in place; re-run `validate`.
- **Rename:** rename the file (the command name follows the filename); no other change needed.
- **Delete:** remove the file.

## Reference implementations

Prior art worth reading (referenced, not imported): the live command set under
`~/.claude/commands/` — `reflect.md` (a heavy procedural command) and `apex-client.md` (a thin
dispatch) are the two ends of the range. There is no Codex command equivalent.
