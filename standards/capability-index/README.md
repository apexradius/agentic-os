# capability-index

The executable half of [`doctrine/standards/capability-index.md`](../../doctrine/standards/capability-index.md):
proves the committed `CAPABILITIES.md` catalog at the repo root is a faithful, drift-free render of the
live capability tree — every skill, agent, and MCP server/tool the repo actually ships. Discoverability is
the whole point of a catalog; a catalog that silently lags reality is worse than none, because readers
trust it.

A single tree of plain `.mjs` with **zero npm dependencies**, discovered by `validate.mjs --all` like every
other standard. It hand-rolls a tiny scalar-frontmatter reader rather than importing `yaml`, so the gate runs
on a bare extraction with no install.

## Why the catalog lives at the repo root

`CAPABILITIES.md` is written to the **repo root**, not under `framework/`, for two reasons: it aggregates
both zones (`framework/` generic + `apex/` instance), and it embeds `apex`-zone descriptions verbatim, which
the zone-purity tripwire forbids inside `framework/`. The *generator and gate* are zone-pure generic and ship
with the framework; only their output spans zones — like the root `README`.

## What it checks

- The frontmatter/tool readers pass their RED/GREEN selftest (scalar parsing, fence handling, tool
  extraction) so the gate can't rot.
- `CAPABILITIES.md` exists at the repo root.
- It **byte-matches a fresh render** of the live tree (`framework/skills`, `apex/skills`, `framework/roles`,
  `apex/agents`, `framework/runtime/mcp-servers`, `apex/runtime/mcp-servers`) — the load-bearing anti-drift
  check, mirroring `emit.mjs --check`.

## Refresh

The catalog is generated, never hand-edited. After adding or changing a skill, agent, or MCP tool:

```bash
node framework/standards/capability-index/generate.mjs          # rewrite CAPABILITIES.md
node framework/standards/capability-index/generate.mjs --check   # CI: fail if it drifted
```

Tool lists are a best-effort static scan of `server.tool(...)` registrations; vendored-proxy or
programmatically-registered tools are not statically visible and are not counted.

## Verify

```bash
node framework/standards/capability-index/validate.mjs    # selftest + drift check
node framework/primitives/_lib/validate.mjs --all          # runs the above inside the full harness
```

> Last reviewed: 2026-06-29
