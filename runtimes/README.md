# framework/runtimes — runtime bindings

The harness (skills, laws, decision gate, telemetry, orchestration loop) is
runtime-agnostic in principle. A **runtime binding** is what makes that true in
fact for one specific agent runtime: it documents how each harness invariant is
enforced there, and what the runtime cannot enforce natively (so the gap is
closed by seeding, adapters, or explicit operator procedure — never by hoping).

A runtime without a binding is not a supported lane. Prose SOPs transfer across
runtimes; enforcement does not — every binding point below was earned by a run
where the missing binding produced a real failure.

## The five binding points

Every binding document answers these five, in this order:

1. **SOP loading** — how skills/SOPs reach the runtime. Always mirrored or
   mounted from the canonical source by a sync tool; never hand-copied
   (hand-synced copies drift and crash on environment differences).
2. **Decision-gate halt** — how a preference fork stops the run until an
   operator answers. Native ask tool where one exists; otherwise the
   turn-boundary pattern: emit `decision-ask.json`, end the turn, resume only
   on an operator turn. Either way `resolution.basis` must be operator-attributable
   (no-self-ratification law).
3. **Telemetry / trajectory capture** — how a run becomes a scoreable
   trajectory. Live span emission is preferred; a post-run session-log
   converter is the fallback. A lane where runs cannot be floor-scored is
   blind, not bound.
4. **Subagent dispatch** — how workers spawn, what return shape is enforced,
   and how the main context verifies handovers. Runtime-native dispatch is
   fine; return-shape and verification discipline are harness-owned and must
   be enforced by the orchestrator regardless of runtime.
5. **Scope fence** — how reads/writes are confined to the task tree. The fence
   must be **seeded into the run** (launch flags, profile, config in the
   working tree) — a fence that exists only as operator vigilance over an
   approval stream is a gap, not a binding.

## Conformance

A runtime is a supported lane when:

- all five binding points have a documented mechanism in its binding doc, and
- at least one benchmark run from that runtime has been scored end-to-end by
  the shared scoring pipeline (same golden, same judges, same floor).

## Zone note

These documents are generic. Instance wiring — concrete mirror paths, launch
commands, provider credentials, seeded profiles — lives in the instance repo,
not here.

## Bindings

- [`claude-code.md`](claude-code.md) — native ask tool, hook telemetry, launch-flag fence.
- [`codex.md`](codex.md) — turn-boundary gate, rollout-log adapter, seeded-profile fence.
- [`opencode.md`](opencode.md) — plugin-enforced gate/telemetry, permission-config fence.
