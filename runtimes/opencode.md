# Runtime binding — OpenCode

Third lane. Reviewed against the harness (strong plugin/hook surface, native
markdown skills, headless server mode); bindings below are the design contract
for standing the lane up. Status: **conformant** — a benchmark run has been
driven through this runtime headless and scored end-to-end by the shared
pipeline (golden comparison, judges, deterministic floor, diff-aware gates)
with zero scoring-side special cases. Conformance proves the lane's
instrumentation, not the driver model's parity.

## 1. SOP loading

Native `SKILL.md` discovery (project `.opencode/skills`, global config skills,
plus Claude-compatible skill directories). Binding: mount or generate from the
canonical source via the same sync tool as the other lanes — a third
hand-maintained copy is how drift starts. Registry search/fetch is not native;
expose it through the MCP client or a custom tool.

## 2. Decision-gate halt

Native `question` tool plus plugin-level `permission.ask` make interactive
halts feasible. Binding: a custom decision-gate tool (or plugin) that validates
the `decision-ask.json` envelope, asks the operator, records the answer with an
operator-attributable basis, and blocks continuation until resolved. Headless
mode is the hard case: the run must terminate in an explicit
blocked-awaiting-decision state rather than letting the model continue past an
unanswered fork — the cross-vendor lesson (models self-resolve forks unless the
halt is structural) applies with full force.

## 3. Telemetry / trajectory capture

Primary: plugin hooks around tool execution emitting spans (session id, tool,
agent, redacted input head, result status, duration) in the shared trajectory
schema — this is live emission, better than the log-conversion fallback the
Codex lane needs. Fallback only: sanitized session export or the local session
DB (the DB schema is not a stable contract; never make it the primary
instrument). Same redaction law as every lane: no raw arguments in spans.

## 4. Runtime agents and dispatch

Native primary agents and subagents with per-agent model pins. Binding: define
exactly two runtime roles, `plan` and `build`, each with `mode: "all"` so the
same roles are available as primary agents and spawnable subagents. Both inherit
the shared OpenCode permission profile with no agent-local `permission` or
`tools` narrowing, and both carry a high `steps` budget so model selection can
change per role without multiplying runtime lanes. Return shape, file ownership,
route policy, and main-context verification are enforced by the shared SOP plus
validator plugins, same as every lane.

## 5. Scope fence

Permission config (allow/ask/deny, per-agent, wildcard tool patterns) is a true
seeded fence — closer to the reference lane than to the approval-stream
fallback. **Required posture:** the default configuration is permissive; never
run harness work without a hardened profile (deny-by-default for write, shell,
web, and dispatch outside the task tree; minimal MCP allowlist).

## Lane cautions

- **Auth:** never route a chat subscription's OAuth through this runtime as an
  unattended lane — that is a provider-ToS violation, not a technical detail.
  Use official API credentials or a local-model provider lane.
- **Stability:** the runtime moves fast and several hooks are experimental.
  Pin the version for harness work; smoke-test plugins on every upgrade.

## Earned cautions (first standup)

- **Headless `ask` is a silent infinite hang.** With no TTY, any permission
  set to `ask` blocks forever with zero output — indistinguishable from a hung
  model. Headless agents must use allow/deny only, so a denial fails loud.
  Keep `ask` for interactive agents only.
- **Plugins are not auto-discovered.** Files placed in a config-dir plugin
  folder do not load by themselves; register each plugin explicitly in the
  profile's `plugin` list. Verify load by an observable init side effect
  (e.g. the telemetry plugin creating its spool dir).
- **Endpoint-good ≠ adapter-good.** A local model endpoint can prove out
  perfectly by direct probe (non-streaming and SSE) while a `run` through the
  runtime produces nothing. The lane smoke must assert a completed `run`
  through the runtime itself.
- **A "stall" is a latency claim — check the model server before blaming the
  stream.** What presented as an adapter stream stall was prompt-eval latency:
  the runtime's log stopped at `stream providerID=…`, but the model server's
  own log showed a 67K-token prompt grinding at ~330 tok/s — minutes to first
  token, longer than every smoke timeout. Diagnose with the server's
  prompt-progress log and a patient control run before concluding "hang."
- **Local models yield early — headless drives need a continuation loop.**
  The runtime's agent loop runs until the assistant stops calling tools;
  frontier models keep acting, small local models narrate intent (or declare
  completion) in a prose turn and the run exits. A headless bench drive needs
  a mechanical continuation driver — a content-free token re-sent while the
  expected terminal artifact is absent, iteration-capped and logged as harness
  turns. Expect small models to claim done work that never touched the tree;
  that is a candidate failure the scoring measures, not a lane defect.
- **Global skill discovery bloats every prompt.** The runtime scans user-wide
  skill directories (its own config dir plus other harnesses' conventions) and
  injects the merged listing into each request; a machine with several
  harnesses' skill corpora can add tens of thousands of tokens per turn —
  crippling for local models. `skills.paths` is add-only and discovery cannot
  be path-disabled; scope per agent instead: `tools: { skill: false }` omits
  the listing entirely, and `permission.skill` allow/deny patterns scope which
  skills are listed. Headless and local-model agents must ship with one of the
  two.

## Conformance exit test

Same benchmark fixture, driven through this runtime headless, scored by the
shared pipeline (golden comparison, judges, floor) with zero scoring-side
special cases. **Passed** — the run was collected (working-copy diff with user
ignore files disabled), exported through the lane's spans-plus-session-storage
exporter, and scored end-to-end; the candidate's own verdict is whatever the
pipeline says it is. One floor caveat carried forward: with the route
fingerprint demoted for cross-model scoring, the remaining floor metrics can
degenerate to pass on a near-empty run — floor green on a tiny trajectory is
not evidence of discipline; the judge dimensions carry that weight.
