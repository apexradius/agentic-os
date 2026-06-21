# @framework/prompt-router-mcp

A local **stdio MCP** that routes a workspace or session to the correct canonical prompt from a
**prompt-os** library, and exposes the library for search/compose. The router's parser reads only
`## heading` + ```` ```text ```` fences, so prompt front-matter is additive and never breaks routing.

## Tools

`route_prompt` · `get_prompt` · `get_prompt_contract` · `list_prompts` ·
`search_prompts_by_section` · `search_prompts_by_eval_status` · `prompt_router_health`.

## Configuration (env)

| Var | Meaning | Default |
|---|---|---|
| `APEX_PROMPT_LIBRARY_PATH` | Path to the prompt library (the instance content). | `./prompt-library.md` (cwd) |
| `APEX_PROMPT_ROUTER_WORKSPACE` | Workspace root the router scans to pick a prompt. | `process.cwd()` |

The library is **instance content** — it is not shipped here. The Apex library source lives under
`apex/config/prompt-router/library/`; point `APEX_PROMPT_LIBRARY_PATH` at it (or any conformant library).

## What ships here vs. what doesn't

- **Ships (generic):** the engine (`src/`), the prompt-os tooling (`scripts/`), the tests (`test/`),
  the format **schema** (`library/schema/prompt-os.schema.json`), and the generic **loop contracts**
  (`library/loops/` — reflexion, PIV, planner-generator-evaluator, ralph).
- **Does not ship (instance):** the prompt content (`prompts/`, `golden/`), `eval-config.json`,
  `CONTRACT.md` → all under `apex/config/prompt-router/library/`.
- **Generated, never committed:** `library/index.generated.md`, `library/index.json`,
  `library/labels.json` (emitted by `npm run prompt-os:build` from a library; see `.gitignore`).

## Build / run

```bash
npm run build                       # tsc → dist/
npm start                           # run the MCP over stdio
npm run prompt-os:build             # regenerate the library index from a prompt library
npm test                            # vitest — integration/migration suites self-skip without a library
```
