# framework/runtime — the reference engine

The control-plane code that enforces the doctrine the rest of the framework documents. Generic and
Apex-free; source committed, build artifacts gitignored. Apex wiring lives in `apex/config/`.

| Path | What it is | Status |
|---|---|---|
| [`scheduler/`](scheduler/) | The proactive-loop tick — selects ready/due tasks from the task store (model: [`coordination/scheduler.md`](../coordination/scheduler.md)). Zero-dep, read-only. | active |
| [`observability/`](observability/) | The run-record sink — append-only, redacted run-records per closed task (model: [`doctrine/standards/observability.md`](../doctrine/standards/observability.md)). Zero-dep, opt-in, fail-open. | active |
| [`learning/`](learning/) | The run-record analyzer — turns a window of run-records into signals + bounded review candidates (model: [`doctrine/standards/learning.md`](../doctrine/standards/learning.md)). Zero-dep, read-only, never edits the framework. | active |
| [`statusline/`](statusline/) | A portable Claude Code status line — four graded rows (location · session · limits · priority) rendered from the status-line JSON. Zero instance coupling; the one configurable input is `CLAUDE_STATUSLINE_TASKS_FILE`. | active |
| [`mcp-shared/`](mcp-shared/) | The shared MCP factory (`createApexServer`, error handling, breaker, health) — `@framework/mcp-shared`. | Stage 4D ✅ |
| [`mcp-servers/`](mcp-servers/) | The generic **reference server** on the factory — `@framework/data-mcp` (Postgres, read-only-gated): the worked example an instance copies. An instance's own fleet lives in its instance zone (e.g. `apex/runtime/mcp-servers/`), never in `framework/`. | active |
| [`router/`](router/) | The routing engine: `prompt-router-mcp` (`@framework/prompt-router-mcp`, workspace member) + a Python `semantic/` classifier + a `harness/`. Instance routes/library → `apex/config`. | Stage 4G ✅ |
| [`package.json`](package.json) | npm **workspace** root (`mcp-shared`, `mcp-servers/*` = the reference server, `router/prompt-router-mcp`) + shared [`tsconfig.base.json`](tsconfig.base.json). | Stage 4D ✅ |
| [`verify-zone-purity.sh`](verify-zone-purity.sh) | Zone-purity tripwire — fails on any Apex coupling outside the documented residual ([`.zone-residual.allow`](.zone-residual.allow)). | active |

A retired control-plane ledger engine once lived here; it was archived to a git tag and
removed. Policy/permission enforcement is instance-side machinery, not part of the portable
runtime.
