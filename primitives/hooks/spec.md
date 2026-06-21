# Primitive: Hooks

> A hook is a script the runtime fires on an event (PreToolUse, SessionStart, Stop…) to gate
> or react to agent behavior. This spec is the contract for the **hook entry shape**. Schema:
> [`hooks.schema.json`](hooks.schema.json). Validator: [`validate.mjs`](validate.mjs). Creator:
> [`creator.md`](creator.md).

## The shape of a hooks block

Hooks are registered as a `hooks` map inside a config file — `.claude/settings.json` (which
carries many other keys) or a dedicated `.codex/hooks.json` / plugin `hooks.json`. The map is:
**event → array of matcher-groups → array of hooks**.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          { "type": "command", "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/guard.sh", "timeout": 10 }
        ]
      }
    ]
  }
}
```

A hook is `type: "command"` (runs a script) or `type: "prompt"` (injects an LLM prompt);
`command` is required for the former, `prompt` for the latter. `matcher` is a tool-name
pattern (`"*"` or omitted = all). The nine events: `PreToolUse`, `PostToolUse`,
`UserPromptSubmit`, `Stop`, `SessionStart`, `SessionEnd`, `SubagentStop`, `PreCompact`,
`Notification`.

## Per-runtime, no emit

Hook **scripts** live in separate per-runtime dirs (`~/.claude/hooks/`, `~/.codex/hooks/`) and
the configs differ slightly (settings.json block vs hooks.json file), so there is **no
single-source emit** for hooks in this primitive. The validator reads the `hooks` key out of
*any* config, so one validator serves Claude, Codex, and plugin hooks.

## Validation: two honest layers, and we only own one

This is the primitive where honesty matters most. There are two distinct layers:

1. **Entry shape (this validator owns it).** `ajv` against `hooks.schema.json`: every
   matcher-group has a `hooks` array; every hook has a valid `type` with its matching
   `command`/`prompt`. Plus code-level **warnings**: an unknown event name (typo, or newer than
   this validator), and a `timeout` over the 600s runtime cap. A config with **no** hooks block
   warns and passes (nothing to check).
2. **Runtime I/O contract (this validator does NOT own it).** Whether a hook reads JSON from
   stdin, writes a valid decision to stdout, uses exit `0`/`2` correctly, and fails open is a
   *behavioral* contract — not expressible in a JSON schema. It is **deferred to the existing
   `validate-codex-hook-runtime.py`**. This spec says so plainly so the gap reads as a
   deliberate layering, not an oversight.

Verified against the live set: `~/.claude/settings.json` and `~/.codex/hooks.json` both pass.
An inline `--selftest` keeps `node _lib/validate.mjs --all` non-vacuous on a fresh clone.

## Constraints (what NOT to do)

- **Never claim this validator proves a hook works.** It proves the entry is well-formed. Run
  `validate-codex-hook-runtime.py` for the I/O contract.
- **Never hardcode an absolute path in a hook command** — use `${CLAUDE_PROJECT_DIR}` /
  `${CLAUDE_PLUGIN_ROOT}` so it stays portable.
- **Never let a hook block on its own failure.** Hooks fail open (a crashing hook must exit 0,
  never wedge the agent) — enforced at the runtime layer, not here.

## Verify (executable acceptance)

```
node framework/primitives/hooks/validate.mjs --selftest                 # inline good/bad
node framework/primitives/hooks/validate.mjs ~/.claude/settings.json ~/.codex/hooks.json
# then, for the deferred layer:
python3 <path>/validate-codex-hook-runtime.py <hook-script>             # runtime I/O contract
```
Green entry-shape + green runtime check = the hook conforms.
