# router/harness — manual probes

Standalone Node scripts for sanity-checking the router without spinning up the full MCP. No deps
beyond Node.

| Script | What it does |
|---|---|
| `probe.mjs` | Loads a prompt library + workspace and prints the routing decision — quick "does this workspace resolve to the prompt I expect?" check. |
| `router-test.mjs` | Exercises the prompt-os parser against library records and reports parse warnings. |

```bash
node probe.mjs            # honours APEX_PROMPT_LIBRARY_PATH / APEX_PROMPT_ROUTER_WORKSPACE
node router-test.mjs
```

These read the same env contract as [`../prompt-router-mcp`](../prompt-router-mcp/). Point
`APEX_PROMPT_LIBRARY_PATH` at a library before running.
