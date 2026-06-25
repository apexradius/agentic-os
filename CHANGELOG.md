# Changelog

All notable changes to the **agentic-os** framework are recorded here, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) as defined in
[`doctrine/standards/versioning.md`](doctrine/standards/versioning.md). A **release is a public sync** of
`framework/`.

## [Unreleased]

## [0.2.0] - 2026-06-25

### Added
- **Empirical learning loop** (`doctrine/standards/learning.md` + `runtime/learning/`) — a zero-dependency
  analyzer over the observability run-record log that surfaces recurring failures, rework hotspots,
  duration/cost outliers, and one-sided gates as a **bounded list of review candidates** for a
  human/Council retro. Reads only; has no path that edits the framework — guarding the
  autonomous-self-modification failure mode the standard names.

## [0.1.0] - 2026-06-25

First tagged version. The public tree has existed since 2026-06-20; this draws the initial version line
and contract baseline. Pre-1.0: contracts are still settling — a minor may carry a breaking change, called
out under a **Breaking** heading (see the versioning standard).

### Added
- **Doctrine** — rules (root-cause, reversibility, idempotency, decision-making, …) and standards
  (excellence, communication, design, data-handling, tool-gate, ci, context-budget, session-discipline,
  observability, versioning) — prose law, no machinery mixed in.
- **Primitives** — agents, skills, hooks, commands, mcp-tools, plugins: each a spec + JSON schema +
  creator meta-skill + validator, run by the one-command harness `validate.mjs --all`.
- **Standards-as-code** — deterministic, zero-dependency gates: design-gate, tool-gate (+ PreToolUse hook
  + opt-in audit log), ci, mirror-parity, session-discipline, context-budget, eval-harness, and this
  versioning gate.
- **Coordination** — the append-only ledger (schema + audit trace), the council planning contract, and
  the proactive scheduler model.
- **Runtime engine** — the ledger and council engines, the scheduler tick, the observability run-record
  sink, and the shared MCP server factory — generic, instance-free, with a zone-purity tripwire.
- **Loop** — the PIV (Plan → Implement → Verify) protocol with artifact gates by file count.
- **Prompting** — the `<Agent_Prompt>` house style and its validator.
