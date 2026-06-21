# Creator: how to add or check a plugin

> The SOP for this primitive. Plugins are **consumed**, not authored in this framework — so this
> creator is about installing/validating a plugin and (rarely) authoring a plugin manifest.
> Read [`spec.md`](spec.md) first.

## Installing a plugin (the common path)

1. Add or confirm the marketplace in `known_marketplaces.json` (a `source` of
   `{source: "github", repo: "org/repo"}`).
2. Install through the plugin flow — this writes an `installed_plugins.json` record keyed
   `plugin-id@marketplace` with `scope`, `installPath`, `version`.
3. **Validate the registries** before trusting them:
   ```bash
   node framework/primitives/plugins/validate.mjs \
     ~/.claude/plugins/installed_plugins.json ~/.claude/plugins/known_marketplaces.json
   ```

## Authoring a plugin manifest (rare)

If you publish a plugin, its `.claude-plugin/plugin.json` needs at least `name` +
`description`; add `version` (semver — recommended), `author`, and feature paths
(`skills`, `hooks`, `mcpServers`, `interface`) as the plugin provides. Then:

```bash
node framework/primitives/plugins/validate.mjs path/to/.claude-plugin/plugin.json
node framework/primitives/plugins/validate.mjs --selftest
```

## Constraints

- Don't hand-edit the two registries — they're tool-managed. Validate, don't author.
- If a real manifest fails validation, reconcile the **schema** to the observed shape; the
  artifact is ground truth (this is how `version` became optional).

## Reference implementation

Prior art worth reading (referenced, not imported): the `plugin-creator` meta-skill at
`~/.codex/skills/.system/plugin-creator/` — its `validate_plugin.py` is the comprehensive
manifest checker (interface fields, asset-path safety, https URLs, no `[TODO:]` markers). This
primitive's validator deliberately checks the lighter structural backbone of the *installed*
artifacts; reach for `plugin-creator` when authoring a publishable plugin.
