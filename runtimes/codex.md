# Runtime binding — Codex CLI

Cross-vendor lane. Every binding below was earned in live cross-vendor
benchmark runs; the two structural gaps (no ask tool, no launch-time fence) are
where this runtime differs most from the reference lane.

## 1. SOP loading

Runtime-scope skills directory (`~/.codex/skills`), populated by the same
canonical sync tool as every other lane, plus `AGENTS.md` in the working tree
for run-scoped instructions. Diff-verify the mirror after sync. **Earned
caution:** files hand-synced outside the sync tool crash on unrebranded
imports — the sync tool exists because hand-copies fail.

## 2. Decision-gate halt

No native ask tool. Binding: the **turn-boundary pattern** — the agent emits
`decision-ask.json`, ends its turn, and resumes only after an operator turn
supplies the answer; `resolution.basis` must be operator-attributable.

**Earned failure:** without this binding stated in the run's instructions, the
model self-resolves preference forks and records a non-operator basis
(`task-directive`) — the exact violation the no-self-ratification validator
now catches mechanically. The binding must be seeded in the run's instructions,
not assumed from the SOP.

## 3. Telemetry / trajectory capture

No hook surface. Binding: post-run conversion of the runtime's session rollout
logs (JSONL per session: tool calls, tool outputs, messages, reasoning
markers) into the shared trajectory schema by a dedicated adapter. The adapter
must map **all** tool-call record variants (function calls, custom tool calls,
tool-search calls) — partial mappings silently undercount spans and skew the
deterministic floor. Never persist raw command arguments into trajectories;
keep a redacted head only (secret-safety by construction).

## 4. Subagent dispatch

Native agent threads (interactive) or headless exec invocations dispatched by
the orchestrator. Return-shape enforcement and handover verification are
harness-owned, same as every lane. Headless spawns have two earned traps:
an open stdin pipe blocks the child (spawn with stdin ignored), and a
non-repo working directory requires the repo-check bypass flag. Persist each
judge/worker's raw output to a file before parsing — spawn defects are
invisible until an audit trail exists.

## 5. Scope fence

No launch-time directory allowlist. Two composable mechanisms:

- **Seeded fence (required for unattended runs):** a profile + `AGENTS.md` in
  the working tree stating the fence (task tree plus the runtime's own config
  directory for SOP lookup; nothing else readable or writable). Proven in a
  full multi-hour benchmark run: fence seeded before kickoff held end-to-end
  with zero fence-related operator turns, where the prior run under the same
  protocol needed a mid-flight operator fence injection.
- **Approval-stream fence (interactive fallback):** the default approval mode
  pauses on every edit/command; the operator verifies paths in each diff
  preview before approving. This works but is a gap by the fence standard —
  it costs an operator turn per approval and fails silent-idle (a run blocked
  on an approval prompt reads as idle to naive monitoring; stall detection
  must recognize the approval prompt explicitly).

**Earned failure:** without the seeded fence, a benchmark driver attempted an
SOP search across a path that contained the benchmark's answer key — caught
only by the operator denying the approval. The fence must exist before the
run, not in the operator's reflexes during it.
