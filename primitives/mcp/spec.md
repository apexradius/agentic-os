# Primitive: MCP servers

> An MCP server exposes tools to the agent over the Model Context Protocol. It is a
> **TypeScript package**, not a frontmatter file — so this primitive is a **convention
> linter**, not a schema validator. Schema (package.json backbone):
> [`mcp.schema.json`](mcp.schema.json). Validator: [`validate.mjs`](validate.mjs). Creator:
> [`creator.md`](creator.md).

## The shape of a server

An MCP server is a package built on the shared factory:

```
github-mcp/
├── package.json            # @framework/github-mcp; depends on @framework/mcp-shared + the SDK; ESM
├── src/
│   ├── index.ts            # createApexServer(...) + registerHealthTool(...) + register*Tools(...)
│   └── tools/
│       ├── repos.ts        # export function registerRepoTools(server) { server.tool("create_repository", …) }
│       └── …
└── tsconfig.json
```

The factory is `createApexServer(opts)` from `@framework/mcp-shared`; tools register via
`server.tool(name, desc, zodSchema, handler)` with **snake_case** names; every server exposes a
`system_health` tool via `registerHealthTool`. Tools are addressed as `mcp__<server>__<tool>`.

## The factory lives in-repo; servers are extracted alongside it

As of **Stage 4**, the shared factory lives in this repo at
[`framework/runtime/mcp-shared`](../../runtime/mcp-shared) (published as `@framework/mcp-shared`),
with the generic reference server under `framework/runtime/mcp-servers/` (data-mcp). This primitive has **no emit**
of its own — it lints a server directory by path (in-repo or live).

## Validation: a convention linter (honest scope)

`validate.mjs` lints a **directory**, in two honesty tiers — and it says plainly what it does
**not** do: it does **not** validate zod input schemas, tool handlers, or runtime behavior.

- **Errors (structural):** `package.json` present, valid JSON, with a `name`
  (checked against [`mcp.schema.json`](mcp.schema.json) — the one schema-checkable artifact);
  an entry file (`src/index.ts`).
- **Warnings (convention):** depends on the shared factory (`@framework/mcp-shared`) and
  `@modelcontextprotocol/sdk`; is ESM (`type: module`); has a `tools/` directory; exposes
  `system_health` / `registerHealthTool`; every `server.tool()` name is snake_case.

Warnings (not errors) for the conventions because the corpus is mixed: first-party `apex-*-mcp`
servers follow all of them; **vendored** servers (`shopify-mcp`, `mcp-gsc`, …) legitimately do
not. Verified live: `apex-github-mcp`, `apex-core-mcp`, `apex-data-mcp` lint clean;
`shopify-mcp` warns (no shared factory, no `system_health`) — exactly right. An inline
`--selftest` builds temp good/bad layouts so `node _lib/validate.mjs --all` stays non-vacuous.

**Factory override.** The linter checks for a dependency on the shared factory, which defaults to
the in-repo `@framework/mcp-shared`. An org running its own factory under a different package id
(e.g. a fork published under its own scope) overrides the name via the `APEX_MCP_SHARED_FACTORY`
env var — no code edit. The MCP SDK name (`@modelcontextprotocol/sdk`) is the standard, not
coupling.

## Constraints (what NOT to do)

- **Never claim this proves a server works.** It checks layout and conventions, not behavior.
  Tool correctness is the server's own test suite's job.
- **Never fail a vendored server for missing Apex conventions** — they warn, by design.
- **Keep tool names snake_case** and **always register `system_health`** in first-party
  servers; the linter warns when you forget.

## Verify (executable acceptance)

```
node framework/primitives/mcp/validate.mjs --selftest                       # always-runnable, non-vacuous
node framework/primitives/mcp/validate.mjs framework/runtime/mcp-servers/<name>-mcp   # lint a server dir by path
```
Clean (no errors) = the server conforms to the structural contract; address warnings to meet
the full convention.
