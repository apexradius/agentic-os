# framework/runtime/router — the routing engine

Generic, Apex-free prompt routing. Two independent routers plus a probe harness. The instance
wiring (the Apex prompt library, tuned routes, fleet/launcher scripts) lives in `apex/config/`.

| Path | What it is | Runtime |
|---|---|---|
| [`prompt-router-mcp/`](prompt-router-mcp/) | stdio MCP that maps a workspace/session → the correct **canonical prompt** from a prompt-os library. `@framework/prompt-router-mcp`. | Node / TS |
| [`semantic/`](semantic/) | FastEmbed **classifier**: a prompt → one of `{chitchat, tool_op, engineering}`, to triage which pipeline handles it. | Python |
| [`harness/`](harness/) | Manual probes — `probe.mjs` (library/route sanity) and `router-test.mjs` (parser checks). | Node |

These are the **mechanism**. The values they read are instance content:

- Prompt library → `APEX_PROMPT_LIBRARY_PATH` (Apex source under `apex/config/prompt-router/`).
- Tuned routes → `APEX_ROUTER_ROUTES` or a `config/routes.yaml` (Apex copy under `apex/config/orchestration/`).
- Fleet-sync / repoint / launcher scripts → `apex/config/{prompt-router,orchestration}/`.

> Live until cutover: the live copies under the host monorepo (`<monorepo>/…/apex-prompt-router-mcp`
> and `<monorepo>/…/semantic-router`). This is a copy; the live paths keep running.
