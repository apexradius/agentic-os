# Creator: how to add or change an MCP server

> The SOP for building an MCP server to the Apex convention. Read [`spec.md`](spec.md) first.
> This primitive lints layout + conventions; the server's own tests prove tool behavior.

## Author the server

1. **Package.** Create `<name>-mcp/` with a `package.json`: name `@framework/<name>-mcp`,
   `type: "module"`, a `bin`/`main` pointing at `dist/index.js`, and dependencies on
   `@framework/mcp-shared` (the factory) and `@modelcontextprotocol/sdk`.
2. **Entry.** `src/index.ts` calls `createApexServer({ version, healthChecks })`, then the
   `register*Tools(server)` functions, then `registerHealthTool(server, {...})` so the server
   exposes `system_health`.
3. **Tools.** One `src/tools/<domain>.ts` per tool group, each exporting
   `register<Domain>Tools(server)`. Register with
   `server.tool("<snake_case_name>", "<description>", <zodSchema>, <handler>)`. Keep names
   snake_case; they surface to agents as `mcp__<server>__<tool>`.

## Verify (the gate)

```bash
node framework/primitives/mcp/validate.mjs <path>/<name>-mcp     # structure + conventions
node framework/primitives/mcp/validate.mjs --selftest
# plus the server's own build/test for tool behavior (not this primitive's job):
npm --prefix <path>/<name>-mcp run build && npm --prefix <path>/<name>-mcp test
```

Done = the linter reports no errors (address warnings to meet the full convention) **and** the
server's own tests pass. A clean lint with broken handlers is a server that loads and then
misbehaves — the lint is necessary, not sufficient.

## Constraints

- Don't skip `system_health` in a first-party server — observability is the convention.
- Don't use camelCase/PascalCase tool names — the linter warns; downstream addressing assumes
  snake_case.
- Don't put instance business specifics in a server meant to be generic; first-party servers
  live in `framework/runtime/mcp-servers/` (extracted in Stage 4), with install-specific values
  in `apex/config/mcp`.

## Reference implementation

Prior art worth reading: the shared factory now lives in-repo at
[`framework/runtime/mcp-shared/src/server.ts`](../../runtime/mcp-shared/src/server.ts)
(`createApexServer`); a first-party server under `framework/runtime/mcp-servers/` shows the
canonical layout (`src/index.ts` + `src/tools/*.ts` + `registerHealthTool`). Vendored servers
(`shopify-mcp`, `mcp-gsc`) show the legitimately-non-conventional shape the linter warns
(not fails) on.
