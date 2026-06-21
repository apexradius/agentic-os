# framework/runtime — the reference engine

The control-plane code that enforces the doctrine the rest of the framework documents. Generic and
Apex-free; source committed, build artifacts gitignored. Apex wiring lives in `apex/config/`.

| Path | What it is | Status |
|---|---|---|
| [`ledger/`](ledger/SEAM.md) | The aorg ledger engine — faithful copy of the live stdlib monolith. See [`SEAM.md`](ledger/SEAM.md). | Stage 4A–4B ✅ |
| [`council/`](council/) | The council orchestrator (`council`). | Stage 4A–4B ✅ |
| [`mcp-shared/`](mcp-shared/) | The shared MCP factory (`createApexServer`, error handling, breaker, health) — `@framework/mcp-shared`. | Stage 4D ✅ |
| [`mcp-servers/`](mcp-servers/) | First-party MCP servers (`@framework/<name>-mcp`). 11 TS on the factory (ai, browser, core, data, github, seo, canva, tools, commerce, social, automation) + 3 legacy JS (telemetry, google-drive, omnibus). | Stage 4E ✅ |
| [`router/`](router/) | The routing engine: `prompt-router-mcp` (`@framework/prompt-router-mcp`, workspace member) + a Python `semantic/` classifier + a `harness/`. Instance routes/library → `apex/config`. | Stage 4G ✅ |
| [`package.json`](package.json) | npm **workspace** root (`mcp-shared`, `mcp-servers/*`, `router/prompt-router-mcp`) + shared [`tsconfig.base.json`](tsconfig.base.json). | Stage 4D ✅ |
| [`verify-zone-purity.sh`](verify-zone-purity.sh) | Zone-purity tripwire — fails on any Apex coupling outside the documented residual ([`.zone-residual.allow`](.zone-residual.allow)). | active |

The policy engine (`apex-permission`/`apex-elevate`/`*.allow.toml`) is **referenced, not copied** —
see [`ledger/POLICY-ENGINE.md`](ledger/POLICY-ENGINE.md).
