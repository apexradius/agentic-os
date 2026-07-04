# framework/standards/ — executable enforcement

`framework/doctrine/standards/` holds the **law** as prose — the design standard, the
excellence and communication standards. This directory holds the **machinery that enforces a
standard deterministically**: runnable checkers an instance points at its own artifacts.

The split mirrors the no-bloat contract: doctrine is law (prose), knowledge is state, code is
machinery — never mixed in one file. A standard that can be checked by a machine gets a checker
here; the prose it enforces stays in `doctrine/`, and the JSON-Schema-driven *primitives*
(agents, skills, hooks, …) stay in `framework/primitives/`. This is neither — it is executable
enforcement of a doctrine standard, so it earns its own zone.

| Standard | Prose (law) | Enforcement (here) | Judgment layer |
|---|---|---|---|
| Design taste | [`doctrine/standards/design.md`](../doctrine/standards/design.md) | [`design-gate/`](design-gate/) — deterministic anti-pattern scanner | [`roles/design-critic.md`](../roles/design-critic.md) |
| Tool-gate (safer-by-default) | [`doctrine/standards/tool-gate.md`](../doctrine/standards/tool-gate.md) | [`tool-gate/`](tool-gate/) — deterministic HITL tool-call gate (allow/ask/deny) + PreToolUse hook | [`roles/security-reviewer.md`](../roles/security-reviewer.md) |
| Mirror parity | [`doctrine/README.md`](../doctrine/README.md) — single source ("everything else is a mirror") | [`mirror-parity/`](mirror-parity/) — co-owned manual pairs keep the same outline | human review of mirrored prose |
| Session discipline | [`doctrine/standards/session-discipline.md`](../doctrine/standards/session-discipline.md) | [`session-discipline/`](session-discipline/) — PIV planning gate + lifecycle hooks | human review / the planner role |
| Continuous integration | [`doctrine/standards/ci.md`](../doctrine/standards/ci.md) | [`ci/`](ci/) — reusable workflows + shared tool configs (zone-pure source the instance's delivery repo syncs from) | CodeRabbit / Greptile PR review (Tiers 2–3) |
| Service adoption | [`doctrine/standards/service-adoption.md`](../doctrine/standards/service-adoption.md) | [`service-adoption-gate/`](service-adoption-gate/) — deterministic scanner for unsafe self-host defaults before adoption | security / DevOps review of residual risk |
| Context budget | [`doctrine/standards/context-budget.md`](../doctrine/standards/context-budget.md) | [`context-budget/`](context-budget/) — handoff/compaction discipline hooks + budget checks | human review / the planner role |
| Eval / observability | [`doctrine/standards/observability.md`](../doctrine/standards/observability.md) | [`eval-harness/`](eval-harness/) — runs each skill's `eval.md`, emits a pass/fail scoreboard (sink: [`runtime/observability/`](../runtime/observability/)) | instance judge endpoint / human review of eval verdicts |
| Judge bias | [`doctrine/standards/judge-bias.md`](../doctrine/standards/judge-bias.md) | [`judge-bias/`](judge-bias/) — proves judge gates declare order-swap judging, judge separation, and verbosity/self-preference controls | human review of rubric fit |
| Judge validity | [`doctrine/standards/judge-validity.md`](../doctrine/standards/judge-validity.md) | [`judge-validity/`](judge-validity/) — proves judge gold sets carry paired ratings with minimum Cohen's kappa agreement | human review of gold-set representativeness |
| Faithfulness trace | [`doctrine/standards/faithfulness-trace.md`](../doctrine/standards/faithfulness-trace.md) | [`faithfulness-trace/`](faithfulness-trace/) — proves every closeout claim carries evidence type, pointer, observed result, and timestamp | human review of evidence sufficiency |
| Adversarial review | [`doctrine/standards/adversarial-review.md`](../doctrine/standards/adversarial-review.md) | [`adversarial-review/`](adversarial-review/) — proves review artifacts check adversarial failure modes and back findings with evidence | human review of finding correctness |
| Orchestration manifest | [`coordination/orchestration.md`](../coordination/orchestration.md) | [`orchestration-manifest/`](orchestration-manifest/) — proves multi-agent DAG manifests declare owners, dependencies, validation commands, output artifacts, and resume keys without cycles | human review of owner fit and validation sufficiency |
| Versioning | [`doctrine/standards/versioning.md`](../doctrine/standards/versioning.md) | [`versioning/`](versioning/) — proves `VERSION` is valid SemVer and the `CHANGELOG`'s latest released entry matches it | human review of the bump decision (MAJOR/MINOR/PATCH) |
| Threat model (build-time) | [`doctrine/standards/threat-model.md`](../doctrine/standards/threat-model.md) | [`threat-model/`](threat-model/) — proves every shipped `THREAT-MODEL.md` answers the four questions (trust boundary / privilege / blast radius / mitigation) | [`roles/security-reviewer.md`](../roles/security-reviewer.md) — judges whether the reasoning is right |
| Reference integrity | [`doctrine/standards/reference-integrity.md`](../doctrine/standards/reference-integrity.md) | [`reference-integrity/`](reference-integrity/) — every internal link in the architectural docs resolves + every standard and rule is on its index | human review of doc structure |
| Primitive integrity | [`doctrine/standards/primitive-integrity.md`](../doctrine/standards/primitive-integrity.md) | [`primitive-integrity/`](primitive-integrity/) — every primitive definition ships spec + schema + creator + validator (no folder the harness silently skips) | human review of new primitive design |
| Standard shape | [`doctrine/standards/standard-shape.md`](../doctrine/standards/standard-shape.md) | [`standard-shape/`](standard-shape/) — every gate obeys the shared contract: node shebang, zero npm deps, parseable selftest tail + sibling README | human review of whether the checks are the *right* checks |

Each checker is **zone-pure generic** (zero Apex coupling — it ships with the framework on
extraction) and wired into the one-command harness: `validate.mjs --all` discovers every
`framework/standards/*/validate.mjs` alongside the primitive validators and runs its selftest.

**Adding a gate?** [`_creator.md`](_creator.md) is the authoring SOP — it produces a checker that
conforms to the [`standard-shape`](standard-shape/) contract in one pass.

> Last reviewed: 2026-06-25
