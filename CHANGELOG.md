# Changelog

All notable changes to the **agentic-os** framework are recorded here, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) as defined in
[`doctrine/standards/versioning.md`](doctrine/standards/versioning.md). A **release is a public sync** of
`framework/`.

## [Unreleased]

## [0.4.0] - 2026-06-25

### Added
- **Reference-integrity standard** (`doctrine/standards/reference-integrity.md` + `standards/reference-integrity/`)
  — a zero-dependency gate proving the framework's connective tissue stays honest: every internal markdown link
  in the architectural docs resolves, and every doctrine standard, doctrine rule, and standards-as-code gate is
  listed in its index (the link scan proves the reverse — no index entry points at a deleted file). Primitive
  bodies (`skills/`, `roles/`), templates, and fixtures are out of scope.
- **Primitive-integrity standard** (`doctrine/standards/primitive-integrity.md` + `standards/primitive-integrity/`)
  — a zero-dependency gate proving every primitive *definition* ships its full machinery (`spec.md` + a
  `*.schema.json` + `creator.md` + `validate.mjs`). Closes a blind spot: the harness discovers primitives by the
  existence of their validator, so a primitive missing its validator (or schema, or creator) was silently
  *skipped* — never counted, never failed. This flags an incomplete primitive by name. Definition-completeness,
  distinct from the per-primitive validators' instance-validity.
- **Loop durability** (`loop/durability.md` + `runtime/durability/`, wired into the scheduler's proactive loop
  in `coordination/scheduler.md`) — crash-durability for unattended runs: an append-only step journal plus a
  replay rule so a killed run resumes without re-firing a side effect it already completed. Opt-in and
  fail-open (mirrors the observability sink); the replay key is `hash(task_id + step + salient_inputs)`, so a
  re-run lands exactly-once. A convention-plus-schema, not a vendor runtime — an instance may back the journal
  with a file, a table, or a durable-execution product. Closes the process-loss gap that WHISK (context loss)
  and rollback-on-verify-failure (a *bad* slice) leave open.
- **Standard-shape standard** (`doctrine/standards/standard-shape.md` + `standards/standard-shape/`) — the gate
  that holds the gates to their own contract. Every standards-as-code `validate.mjs` must carry the node
  shebang, import only `node:` builtins or relative paths (**zero npm dependencies** — the load-bearing check:
  a gate that imports a package passes for its author and breaks on a bare extraction with no install), print
  the parseable `<name>: X/Y selftest checks passed` tail with a non-zero exit on failure, and ship a sibling
  `README.md`. Closes the asymmetry where primitives were held to spec+schema+creator+validator but the
  enforcement layer itself was not. Name-matched doctrine law is deliberately not required.

## [0.3.0] - 2026-06-25

### Added
- **Build-time threat-model standard** (`doctrine/standards/threat-model.md` + `standards/threat-model/`) —
  the design-time security discipline: before a primitive that touches untrusted input or wields privilege
  ships, its author answers four questions (trust boundary, privilege, blast radius, mitigation). A
  zero-dependency gate proves every shipped `THREAT-MODEL.md` answers all four; the tool-gate hook ships
  the worked exemplar (`standards/tool-gate/THREAT-MODEL.md`). Format is enforced here; judgment stays with
  the security-reviewer role.

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
