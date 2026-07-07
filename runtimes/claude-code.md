# Runtime binding — Claude Code

Reference lane: the harness was developed here, so most invariants bind natively.
The gaps below are the ones that produced real failures anyway.

## 1. SOP loading

User-scope skills directory (`~/.claude/skills`), populated by the canonical
sync tool from the framework source. Project-scope skills load from the working
tree. Verify the mirror by diff after every sync — a sync that reports success
is not a verified mirror.

## 2. Decision-gate halt

Native ask tool (`AskUserQuestion`): the run blocks mid-turn until the operator
answers. The gate artifact (`decision-ask.json`) is still emitted — the ask tool
is the halt mechanism, the artifact is the audit record; both are required.
`resolution.basis` records the operator answer (`operator-answer`), satisfying
the no-self-ratification law mechanically.

## 3. Telemetry / trajectory capture

Live: lifecycle hooks emit spans per tool call and subagent stop. **Earned
caution:** hooks are project-scoped — a run in a fresh throwaway tree emits
nothing unless the seeding step provisions the hooks into that tree's runtime
config. Fallback (proven repeatedly): a backfill converter that replays the
session transcript through the unchanged hook to produce identical spans
post-run. Collection protocol is backfill-first: reconcile live spans against
the transcript before scoring.

Known live gap: main-session spans can be dropped while worker spans persist
(watermark present, spans absent). Backfill covers it; treat live emission as
an optimization, not the source of truth.

## 4. Subagent dispatch

Native subagents/teams. Return shape and handover verification are enforced by
the orchestrator (shape-gate rejects nonconforming returns and re-demands).

**Known runtime defect — orphaned returns:** a worker can signal "finished"
while its return content is never delivered, stalling the driver indefinitely.
Binding rule (orphaned-return recovery law): a contentless completion signal
means *read the worker's persisted artifacts and proceed*; at most one nudge,
never an open-ended wait. Monitoring must detect stalls by pane/output
staleness, not by spinner presence.

## 5. Scope fence

Launch-time directory allowlist (additional-directory flags) plus a permission
mode confined to the task tree. This is a true seeded fence: the runtime
refuses out-of-fence writes without any operator attention. The benchmark
shield (no answer keys or goldens reachable from the task tree) composes with
it at seeding time.
