# Changelog

All notable changes to the **agentic-os** framework are recorded here, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) as defined in
[`doctrine/standards/versioning.md`](doctrine/standards/versioning.md). A **release is a public sync** of
`framework/`.

## [Unreleased]

## [0.6.0] - 2026-06-25

### Added
- **Self-validating CI** (`.github/workflows/framework-validate.yml`) — the framework now runs its own
  one-command harness (`validate.mjs --all`) and the zone-purity tripwire on every push/PR. The repo that
  ships a `ci/` standard and preaches CI gates is now gated by them; an adopter who extracts the tree inherits
  a working, zero-install CI starter. Closes the gap where `ci/` shipped consumer templates but applied none to
  the framework itself.
- **Quickstart adoption guide** (`QUICKSTART.md`, linked from `README.md`) — a five-step on-ramp from a fresh
  clone to a validated framework wired into a consumer project: get it → prove it runs (zero install) → read the
  map → wire one slice → keep it honest in CI. The published framework previously had no "how do I use this" path.
- **Standards creator** (`standards/_creator.md`) — the authoring SOP for a new standards-as-code gate, the
  sibling to each primitive's `creator.md`: when a gate is warranted, the shape contract it must satisfy, the
  step list (ground first, RED/GREEN selftest, index, changelog), a copy-paste skeleton, and the anti-patterns.
  Closes the asymmetry where primitives had creators but the enforcement layer's own authoring was undocumented.
- **Roles documented as a validated class** (`roles/README.md`) — clarified that role definitions are not loose
  prose: they are schema-validated and zone-guarded by the `agents` primitive validator and run under
  `validate.mjs --all`. No machinery added — the validation already existed; the README now points to it.
- **Evidence floor for cross-review** (`coordination/review.md`) — a reviewer's defect must carry evidence
  (a `file:line`, a failing command's output, a named acceptance criterion, or a dated source); an ungrounded
  finding is labeled `[unverified]` and cannot, on its own, bounce the work back or block the ship. Kills the
  costly review failure where a confident-but-stale "this looks wrong" burns a whole round. Names the two
  altitude failures (tunnel / fog) the floor drags a reviewer off.

### Changed
- **Convergence-trend escalation** (`loop/verification.md`) — the bounded convergent loop now escalates on a
  flatlined failure *trend* (failure surface not shrinking across two passes = a ceiling, not a speed-bump),
  not only on the fixed iteration count. The count is the hard cap; the trend is the earlier, more honest stop.
- **Section-level ownership** (`coordination/ledger.md`) — ownership may be claimed at section granularity
  (`plan.md#progress`) for shared artifacts that genuinely carry many hands, so contributors who never touch
  the same lines aren't serialized by a whole-file write-lock. Floors: sections genuinely disjoint + one
  sole-mutator of structure; concurrent byte-level writes still corrupt, so edits still serialize through the
  ledger. Default stays whole-file ownership.

## [0.5.0] - 2026-06-25

### Added
- **`context-canary` skill** (`skills/context-canary/`) — a per-turn integrity signal (first line of every
  reply: name + turn counter + honest self-check) that converts silent context degradation into a binary,
  zero-effort, per-turn check, plus a trip protocol (checkpoint → re-anchor → deliberate reset → re-install).
  The *behavioral* complement to a token-% context guard: the guard watches window capacity, the canary
  watches whether the model still attends to what's already in the window (adherence/compaction drift a
  percentage gauge is blind to). Carries `references/research.md` (the four degradation modes) and a
  failing-baseline `eval.md`. Adapted from `JuliusBrussee/skills` (MIT); genericized to zone-pure framework
  form (runtime name fills in via the `[name]` arg).

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
