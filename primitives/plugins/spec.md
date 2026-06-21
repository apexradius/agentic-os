# Primitive: Plugins

> A plugin is a versioned bundle (skills/agents/hooks/MCP) installed from a marketplace. We
> don't author plugins here — we consume them — so this primitive validates the **JSON
> artifacts** that record what's installed and where it came from. Schema:
> [`plugins.schema.json`](plugins.schema.json). Validator: [`validate.mjs`](validate.mjs).
> Creator: [`creator.md`](creator.md).

## The three artifacts

A plugin is not one frontmatter file. Three JSON files describe the plugin system, and
`validate.mjs` dispatches by **filename** to the matching schema definition:

| File | What it is | Definition |
|---|---|---|
| `installed_plugins.json` | the install registry: `{version, plugins:{ "id@marketplace": [records] }}` | `installedPlugins` |
| `known_marketplaces.json` | the marketplace registry: `{ "name": {source:{source,repo}, …} }` | `knownMarketplaces` |
| `.claude-plugin/plugin.json` | a single plugin's manifest: `{name, description, version?, …}` | `pluginManifest` |

Plugins are GitHub-marketplace-sourced and Claude-managed; there is **no emit/projection** and
no Codex variant in this primitive.

## Validation: structural backbone, leniently

These files are written by tooling and evolve, so the schemas are **lenient**
(`additionalProperties: true` on records) — we assert the structural backbone, not every
field:

- `installed_plugins.json` → `version` + `plugins`; each install record has `scope`,
  `installPath`, `version`.
- `known_marketplaces.json` → each marketplace has a `source` object.
- `plugin.json` → `name` + `description` required. **`version` is recommended but optional** —
  reconciled against reality: official plugins (context7, code-review, pr-review-toolkit) ship
  manifests with no `version`, so a missing version is a **warning**, not a failure.

Verified against the live set: the two registries + all installed manifests validate
(`7/7`, 3 with the version warning). An inline `--selftest` (good + bad per artifact kind)
keeps `node _lib/validate.mjs --all` non-vacuous on a fresh clone.

## Constraints (what NOT to do)

- **Never hand-edit the registries.** `installed_plugins.json` / `known_marketplaces.json` are
  tool-managed; edit them through the plugin install flow, then validate.
- **Don't tighten the schema to reject reality.** If a live manifest fails, reconcile the
  schema to the observed shape (as with `version`) — don't "fix" the artifact.
- **Validate by the real filename.** The dispatch keys on `installed_plugins.json` /
  `known_marketplaces.json` / `plugin.json`; an arbitrary `.json` is rejected with guidance.

## Verify (executable acceptance)

```
node framework/primitives/plugins/validate.mjs --selftest
node framework/primitives/plugins/validate.mjs ~/.claude/plugins/installed_plugins.json \
     ~/.claude/plugins/known_marketplaces.json \
     ~/.claude/plugins/cache/*/*/*/.claude-plugin/plugin.json
```
Green = the plugin artifacts conform.
