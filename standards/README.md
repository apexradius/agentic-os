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
| Context budget | [`doctrine/standards/context-budget.md`](../doctrine/standards/context-budget.md) | [`context-budget/`](context-budget/) — handoff/compaction discipline hooks + budget checks | human review / the planner role |
| Eval / observability | [`doctrine/standards/observability.md`](../doctrine/standards/observability.md) | [`eval-harness/`](eval-harness/) — runs each skill's `eval.md`, emits a pass/fail scoreboard (sink: [`runtime/observability/`](../runtime/observability/)) | instance judge endpoint / human review of eval verdicts |

Each checker is **zone-pure generic** (zero Apex coupling — it ships with the framework on
extraction) and wired into the one-command harness: `validate.mjs --all` discovers every
`framework/standards/*/validate.mjs` alongside the primitive validators and runs its selftest.

> Last reviewed: 2026-06-25
