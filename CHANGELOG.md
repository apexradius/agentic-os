# Changelog

All notable changes to the **agentic-os** framework are recorded here, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) as defined in
[`doctrine/standards/versioning.md`](doctrine/standards/versioning.md). A **release is a public sync** of
`framework/`.

## [Unreleased]

## [0.8.1] - 2026-06-25

### Changed
- **The `aorg` engine reads its instance paths from the environment.** The bundled ledger/council CLI
  (`runtime/ledger/aorg`) hard-coded one instance's knowledge-base layout — the brief's "read before
  work" list, the RAG-gate self-test path, and the plan-hygiene target all pointed at a specific
  `Brain` knowledge tree. These are now env-mediated: `AORG_READ_BEFORE` (a path list), `AORG_RAG_GATE`,
  and `AORG_PLAN_HYGIENE_PATH`, each with a generic fallback — the brief falls back to the framework's
  own READMEs, and an unconfigured gate or hygiene check reports `PASS "not configured"` instead of
  warning on a missing instance file. Removes the last instance-path coupling from the engine copy, so
  a bare extraction's `aorg` doctor is green without an instance present; behavior is byte-identical
  under the live env, which supplies the real paths. (Not breaking: an unset instance gets a more
  lenient PASS than the old WARN; a configured one is unchanged.)

## [0.8.0] - 2026-06-25

### Added
- **Portable status line** (`runtime/statusline/`) — a four-row Claude Code status line
  (location · session · limits · priority) rendered from the status-line JSON, with
  green→yellow→red gauges on the effort, context, and rate fields so an approaching limit reads at a
  glance. Zero instance coupling: the only project-specific input is the task file behind Row 4,
  supplied via `CLAUDE_STATUSLINE_TASKS_FILE` (unset ⇒ the row is omitted, the rest unaffected).
  Closes the gap where the framework documented the loop but shipped no at-a-glance view of an
  agent's live state.
- **`junior-to-senior` skill** (`skills/junior-to-senior/`) — a deliberate second pass that lifts a
  working first draft to senior grade via a six-check lens: edge cases, the invariant (made loud),
  the failure class (swept, not patched), fit & naming, verification you actually ran, and the
  unstated assumption. The portable form of the average→senior→prime quality ladder; carries a
  failing-baseline eval. Distinct from `senior-architect` (diagrams/ADRs). Adapted from
  JuliusBrussee/skills (MIT).
- **AI-failure-mode lens for cross-review** (`coordination/review.md`) — a named lens the reviewer
  of agent-produced work applies by default, since the characteristic failures are invisible to the
  author: hallucinated surface, plausible-but-wrong, silent fallback, scope drift, fabricated
  verification, and confident staleness, each with how to probe it. Complements the evidence floor —
  the lens says *where to look*, the floor says *how to report* — so a lens finding is still
  `[unverified]` until grounded.

## [0.7.2] - 2026-06-25

### Changed
- **Operator identity is now env-mediated in the bundled control-plane engine** — the last of the
  owner-name coupling staged in 0.7.1. The name was a *functional* identity constant (~30 sites plus a
  named function) in the self-protected ledger/council engine: committer-exemption checks, escalation
  targets, the self-review override gate, the reviewer allow-set, and CLI `--to`/`--by` defaults. These
  now read `OPERATOR` / `OPERATOR_EXACT` / `OPERATOR_CONTAINS` from the environment with a neutral
  `operator` default; the instance supplies the real name and aliases via its own env, so every identity
  check resolves byte-identically under the live deployment. The coupled test fixture and two assertions
  were genericized to match.

### Fixed
- **Zone-purity tripwire now catches the owner-name class.** The gate is a snapshot-diff denylist and its
  match pattern simply never listed the owner name, so every owner-name line was invisible to it — the
  root cause of the 0.7.1 leak. The pattern now includes a word-bounded match on the owner's first name
  (word-bounded so it cannot match unrelated words such as `layout` or `crayon`) plus the longer surname
  form, with a comment documenting the class. Bundled atomically with the engine change: hardening the
  gate before the engine was genericized would have reddened CI, and whitelisting the name would have
  re-published it. (This entry deliberately names no owner-name literal — the gate scans the changelog
  too, and the whole point is that the published tree carries no operator identity.)

### Changed
- **Operator-name coupling genericized out of the public tree.** The framework owner's first name had
  leaked into runtime code and docs as a literal — an MCP calendar tool's natural-language example, an
  Apify Keychain account-name fallback, a router telemetry comment, prompt-os test fixtures, the
  agents-primitive zone-guard example, and the ledger/council engine docs. All now use a neutral
  placeholder (`Sam` / "the operator" / a generic example name). One harder case remains staged: the
  bundled control-plane engine carries the name as a *functional* operator-identity constant in ~30
  sites; that is being env-mediated (a generic `operator` default the instance overrides) and the
  zone-purity tripwire hardened to catch the owner-name class (a word-bounded match on the owner name),
  both landing in a follow-up patch behind the engine's self-protection gate.

## [0.7.0] - 2026-06-25

### Added
- **Reference-integrity now catches escaping links.** A relative link whose target resolves *outside* the
  framework root — e.g. `../../../CLAUDE.md` reaching for an instance manual one level above `framework/` — is
  now flagged even when it resolves in a private superproject, because it 404s in the published tree where the
  framework *is* the root. Closes a blind spot: the gate validated against the local filesystem, so escaping
  links passed in the private tree and broke only on extraction — the exact failure the standard exists to
  prevent.

### Fixed
- **Self-validating CI installs the harness toolchain.** The 0.6.0 workflow claimed the umbrella harness was
  zero-dependency and ran it with no install; on a clean CI runner it died with `ERR_MODULE_NOT_FOUND: yaml`
  (the harness parses frontmatter via `yaml` and JSON-Schema-validates via `ajv`, declared in
  `primitives/_lib/package.json`). Added an `npm ci` step and corrected the wording in the workflow,
  `README.md`, and `QUICKSTART.md`: the standards-as-code gates and the zone-purity tripwire are
  zero-dependency; the umbrella harness needs its `_lib` toolchain.
- **mirror-parity README's escaping links removed.** Its `../../../CLAUDE.md` / `../../../AGENTS.md` links
  reached for the instance manuals above the framework root (broken on extraction); they are now inline code,
  since those manuals are a framework *convention* at the consumer's project root, not files in the tree. Both
  this and the CI fix were surfaced by the new self-validating CI on its first real run.

### Breaking (pre-1.0)
- An instance whose framework docs contain a link escaping the framework root will now **fail**
  reference-integrity (it was already broken on extraction; the gate now reports it in the private tree too).
  Fix by pointing the link inside the tree or de-linking the out-of-tree reference.

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
