---
name: agent-orchestrator
description: "Run a complex task as an orchestration loop — decompose into fenced slices, fan out skeptical recon, synthesize a durable ledger, gate decisions, sequence a DAG, dispatch cold workers, and verify each handover in the main context. Use when coordinating multi-agent work, parallel execution, or an agent team."
argument-hint: "[workflow-description]"
---

# Agent Orchestrator

Run a complex task by decomposing it and coordinating disposable workers, then folding their
results back into one verified outcome. This skill is the executable form of the loop; the law
it implements — and the reasoning behind each stage — is
[`framework/coordination/orchestration.md`](../../coordination/orchestration.md). The role lanes
are [`council.md`](../../coordination/council.md), the fan-out contract is
[`fan-out.md`](../../coordination/fan-out.md), and the review discipline is
[`review.md`](../../coordination/review.md).

The loop is a discipline, not a program: there is **no loop validator**. What proves a run is
that each artifact it emits passes an existing gate (see Verify a loop run).

## The loop

1. **Decompose** into slices with disjoint file fences.
2. **Fan out** parallel read-only recon; fold in only the summaries.
3. **Synthesize** the summaries into a durable ledger row per slice.
4. **Gate decisions** — research the discoverable, ask only genuine preference forks.
5. **Sequence** the ready slices into an orchestration manifest (the DAG spine).
6. **Dispatch** each slice to a cold worker as a worker brief.
7. **Verify** every handover in the main context — shape-gate the return, then verify content.
8. **Ratify** each deviation on the record.
9. **Hold** at the gates: recon → WIRING → ratify → build → hand over uncommitted → verifier commits.

## 1. Decompose into disjoint fences

Cut the task so **no two slices own the same file**. Disjoint fences are what make slices
independently verifiable and let read-only slices run in parallel. If two slices need the same
file, they are not yet cut — re-slice, or sequence them so only one holds the file at a time
([`ledger.md`](../../coordination/ledger.md) file-ownership). Collect every slice's owned-file
set and check for overlap before dispatching anything; an overlap is a planning defect, not a
runtime problem to resolve later.

## 2. Fan out to skeptical recon

For breadth-first, read-heavy discovery — independent sub-questions, a sweep across many files
or sources, N candidates judged in parallel — dispatch **read-only** workers at once
([`fan-out.md`](../../coordination/fan-out.md)). Fan out reads; never fan out writes to one file.

Each recon worker takes the skeptical posture of a reviewer: it hunts the failure, grounds
every finding in a `file:line` or a named criterion, and marks anything it cannot ground
`[unverified]` — a question, not a fact ([`review.md`](../../coordination/review.md)). Only a
summary returns (~1–2K tokens), never the worker's trajectory; pulling a full context back in
defeats the isolation that made fanning out worth it.

Put a defect-lens taxonomy in every recon brief. Direct each worker to inspect the target for:

- **Concurrency & atomicity** — read-modify-write without locks or atomic operations, lost
  updates, check-then-act windows.
- **Authorization parity** — protection present on some endpoints or operations but missing on
  siblings.
- **Config coherence** — settings that contradict each other, or declared knobs code never
  consults. When two declared values govern the same data's lifetime or bounds, check them
  against each other; a contradiction between them is its own named defect, not covered by
  "knobs unenforced". Require each recon return to carry a **config-contract table** — one row
  per declared knob: knob, consumer (`file:line` or `none`), enforced?, and which other knobs
  govern the same resource — so contradiction-hunting is a mechanical row sweep (two rows over
  the same resource with incompatible values = a named defect), not a judgment call.
- **Resource bounds** — unbounded growth, missing eviction, missing backpressure.
- **Data lifecycle** — staleness after writes, invalidation gaps, cross-scope leakage.

A recon that maps structure but applies no defect lenses returns inventory, not findings. Reject
it or re-brief it.

## 3. Synthesize into a ledger external to the context

Fold the returned summaries into a **durable ledger row per slice**, written to disk — not held
in the conversation, so it survives compaction. The row's minimum fields are the contract:

- **slice id**
- **status**
- **commit hash(es)**
- **verify evidence** — the command run and the observed result
- **deviations ruled** — each departure from brief, ruled in or out

The prose style is free; the fields are not. This row is what lets the loop resume after a
reset knowing exactly what is done and proven.

## 4. Decision gate

Before asking the operator anything, classify each unknown:

- **Discoverable** — the answer is in code, docs, logs, or a tool call. Find it. Never ask.
- **Preference** — a genuine fork between reasonable options. Batch these and put them to the
  operator with a concrete recommendation for each, so one exchange resolves them all.

This split is the gate — the batched decision-ask it produces is shape-checked by the
decision-gate standard ([`framework/standards/decision-gate/`](../../standards/decision-gate/)),
which enforces the classify-and-batch rule in
[`decision-making.md`](../../doctrine/rules/decision-making.md). Run at least one non-mutating
exploration pass before any clarifying question.

The batched ask is emitted as **`decision-ask.json`** — one entry per fork with its `id`,
`question`, `options`, and `recommendation` — and, in an interactive runtime, put to the operator
through the runtime's question mechanism (the `AskUserQuestion` tool), answered fork by fork. Two
disciplines keep the gate load-bearing:

- **Plan approval is not ratification.** A plan may *propose* a resolution per fork, recommendation
  and all, but approving the plan never ratifies a preference fork — a fork is settled only by its
  explicit, standalone decision-ask. Bundling the forks into the plan and treating blanket plan
  approval as their answer is **decision laundering**, a decision-gate violation.
- **The gate outranks decisiveness.** For a genuine preference fork, this gate overrides any
  ambient "be decisive, don't ask" posture; deciding a preference fork yourself to avoid an ask is
  over-autonomy — a failure equal in kind to asking about a discoverable.
- **No self-ratification.** The agent that raises a fork never writes its own resolution — emitting
  `decision-ask.json` and filling in the answer in the same run ("the task implies it") is decision
  laundering's quieter sibling. In a runtime with no `AskUserQuestion`-style tool, the gate is
  structural: emit the ask, **end the turn**, proceed only on a resolution from an operator turn.
  A `resolution` whose basis is not an operator answer (or a ratified precedent under the rule
  below) fails the gate.
- **Ratified rulings become precedent.** When verification or build work surfaces a new fork after
  the batched ask, test it against the operator's ratified decisions before asking again. Same
  class as an existing ruling: apply the precedent, continue, and record `precedent-applied` in
  `closeout.json` with the ratifying decision id. Genuinely novel class: a follow-up ask is
  allowed, but record it in closeout as a reported deviation from single-ask economy. Having a
  ruling and asking again anyway is a decision-gate violation.
- **Found defects are not forks by default.** When a discovered defect's repair restores
  already-declared intent — docs the code contradicts, protection present on siblings but absent
  on one route, knobs declared but never enforced — the found-defect duty (step 7) governs: repair
  it in scope or record it, and say which in the closeout. Asking the operator for permission to
  fix it is over-asking, the same failure as asking a discoverable. A defect earns a fork only
  when its repair would change declared intent, materially expand the delivery's blast radius, or
  trade off against the task's own goals.
- **Dominance closes a fork.** Test each candidate fork's options against the constraints already
  declared in the tree: if exactly one option preserves every declared bound and contract while
  each alternative sacrifices one — an API change, new state, a declared knob overridden — the
  fork is derivable, not a preference. Decide it and record it in the closeout as
  `decided-by-dominance` with the rationale. Ask only when the surviving options genuinely trade
  off in ways nothing declared can rank (availability vs correctness, cost vs latency). One class
  never closes by dominance: **exposure posture** — ship-live vs ship-dark (a flag flipped or left
  false, a route exposed or gated). Verifiability is not dominance there: a working copy can be
  verified with a local flip and still ship dark. Unless the task states the posture, it is the
  operator's rollout call — the canonical preference fork. Denying the fork exists does not close
  it: a closeout claiming "no preference forks" while the diff flips an exposure knob has decided
  the canonical fork silently — same violation as self-ratifying it. An exposure change in the
  diff requires an operator-ratified exposure decision in the run's artifacts.

The gate checks an exact envelope — emit it, not a private shape:

```json
{
  "kind": "decision-ask",
  "decisions": [
    { "id": "...", "question": "...", "options": ["...", "..."], "recommendation": "..." }
  ]
}
```

Top-level `forks`, a missing `kind`, or an empty `decisions` array fails the gate even when the
content is right. `recommendation` is a **pointer, not prose**: a byte-identical copy of exactly
one `options[]` entry (the gate checks membership, `recommendation ∈ options`). Put the *why* in a
separate optional `rationale` field — appending rationale to the recommendation string breaks
equality and fails the gate even when the choice is right.

## 5. Sequence the spine

Order the ready slices into a runnable DAG. Its serialized, portable form is the **orchestration
manifest**, whose shape gate is
[`framework/standards/orchestration-manifest/`](../../standards/orchestration-manifest/): each
node declares `id`, `owner`, `depends_on`, `files_owned`, `validation_command`,
`output_artifact`, and `resume_key`; IDs are unique, dependencies point at real nodes, and the
graph is acyclic. Beyond acyclicity, a node may declare a `class` (`sync`, `edit`, `cascade`,
`gate-add`, `pin`, `baseline`, `lockfile`, `dep-upgrade`, `test-signal`, `de-bloat`, `publish`),
and the **sequencing-spine standard**
([`framework/standards/sequencing-spine/`](../../standards/sequencing-spine/)) checks the declared
classes obey a data rule table of prerequisites — e.g. a lockfile and test signal before a
dependency upgrade, de-bloat before publish. It checks declared-class ordering only, never infers
a class; the manifest contract is the floor.

Declare a node's `class` only when its rule-table prerequisite exists as an ancestor in the plan
— in a fresh repo the seed/checkout node can carry class `sync` so `edit` nodes have their
ancestor. A declared class whose prerequisite ancestor is absent fails the gate; an undeclared
class is unconstrained. Declaring vocabulary you cannot satisfy is self-inflicted.

The manifest's canonical basename is **`manifest.json`** — one of the loop's three operator-facing
artifacts, with the **`decision-ask.json`** from the gate (step 4) and the **`closeout.json`** the
run folds back to (step 7 / Output). Those three exact basenames are the contract, and the closeout
is JSON, not markdown.

## 6. Dispatch with worker briefs

Hand each ready slice to a cold worker as a **worker brief** — the self-contained cold-start
task defined by the worker-brief primitive
([`framework/primitives/worker-brief/`](../../primitives/worker-brief/)). Do **not** hand-roll a
second brief format: compose the brief against that schema, render it with the primitive's
`render.mjs`, and hand over the `return_contract` it declares. The brief carries the objective,
the self-contained inputs, the constraints (the scope fence), the skeptical stance, the
`verify_bar` (definition of done), and the return contract. One code path, one schema.
For recon briefs, include the defect-lens taxonomy from step 2 in the brief body; leaving it out
turns skeptical discovery into passive inventory.

- **Writes dispatch one slice at a time** — or in parallel only across genuinely disjoint fences.
  Concurrent writers to one file race and corrupt.
- **Reads may fan out freely** (step 2).
- **Tier per slice** is a routing decision matched to the slice's difficulty and risk, not a
  hardcoded model name. A node declares a generic `model_tier` (`strongest` / `mid` / `fast`) and
  `effort`; the [model-tier-routing standard](../../standards/model-tier-routing/) rejects a raw
  model name or an off-ladder effort. Match the hardest reasoning to the strongest tier, route
  bulk read/summarize work to a cheaper one, and record the choice.

## 7. Verify in the main context

On every worker handover, in this order:

1. **Shape-gate the return first.** Run the worker-brief `validateReturn(doc, contract)` twin
   before reading a single claim. A return that fails its shape is not evidence of anything —
   reject it and re-dispatch. Shape-gate, then verify content.
2. **Verify the content skeptically.** The burden of proof is on the worker. Rerun the slice's
   own gates yourself; probe the changed path with **red inputs outside** the worker's own
   harness (a worker that graded its own homework proves nothing); live-fire the real path
   end-to-end and observe the output.
3. **On failure, roll back — do not patch the patch.** Revert the slice to a clean checkpoint,
   re-read the plan, and re-brief from the corrected understanding
   ([`framework/loop/`](../../loop/README.md)).
4. **Found-defect duty.** Any security or correctness defect the pass turns up in the touched code
   is named as a finding in the run's `closeout.json`, even when repairing it is out of the slice's
   scope. Silently preserving a discovered defect as if it were the spec — carrying it forward
   unflagged because the brief did not ask to fix it — is itself a verification-discipline failure.
5. **Closeout recon sweep.** Before emitting `closeout.json`, sweep every recon summary and worker
   report for defect-shaped observations: pre-existing defects, contradictory or silently
   unenforced configuration, hazards noted in passing, and design inputs that also imply broken
   invariants. Each one must land in found defects as `fixed`, `recorded`, or `ruled-non-defect`
   with the reason. If a defect surfaced during recon and vanishes by closeout, the synthesis
   failed. **Dismissal requires a probe:** `ruled-non-defect` carries the same evidence grade as
   `fixed` — a persisted probe demonstrating the behavior is safe, cited by path. Argument-only
   dismissal is the defect surviving with a rationale attached. No safety probe constructible →
   the disposition is `recorded` (operator-visible open finding), never `ruled-non-defect`.
   **A probe is an executed artifact, not a citation:** pointing at the code under analysis
   (`source.js:NN`) is the argument restated with a line number — probe evidence points at
   output the run itself produced (a command's captured result in the verify tree). If the
   safety case rests on reading the source, the disposition is `recorded`.
   **The sweep includes the task's own motivation:** when the delivered capability replaces
   pre-existing behavior (session-scoped keys over a shared key, an authenticated route over an
   open one), the original behavior is itself a found defect — named with disposition `fixed`
   by the feature — never silently subsumed as "the feature". The delivered diff proves it
   existed.
6. **Claim precision.** Write each closeout claim to state exactly what its evidence proves: cite
   the command run and the output observed, never a probe summary standing in for one. When a
   ratified decision intentionally changed pre-existing behavior, carve it out of any
   compatibility claim explicitly ("preserved, except the ratified X") — an unqualified "behavior
   preserved" that the diff contradicts is a false claim. A compatibility claim covers the
   **whole calling contract**, not just behavior: signature, sync-vs-async, return type, error
   channel. A function made `async` changed its return shape for every existing caller — carve it
   out or prove the old call shape still works before claiming "unchanged".
7. **Persisted proofs.** Every proof a closeout cites exists as an artifact in the run's output
   and is cited by path — repo-state checks included (persist the clean-tree / commit-list output,
   e.g. to `orchestration/verify/`, and point at it). "Observed" in prose with no surviving
   artifact is unfalsifiable and reads as unproven.
8. **Re-emit per round.** When a verify round fails and a fix lands, the re-run replaces or
   supersedes the failing report on disk — the final persisted artifact must match the final
   claim. A closeout citing green while the surviving report shows the red round is a false
   claim even when the re-run genuinely happened.
9. **Recover orphaned returns from artifacts.** When a worker's runtime signals completion but
   its return document never arrives — a delivery failure, not a content failure — read the
   worker's persisted outputs (return file, reports, transcripts) as the return; a persisted
   artifact outranks an undelivered message. One nudge is diligence; waiting or re-nudging past
   that treats a delivery failure as pending work. Artifacts absent too → the slice failed:
   re-dispatch fresh.

Verification is done by an agent that did **not** build the slice
([`review.md`](../../coordination/review.md)).

## 8. Ratify deviations

A worker that departed from its brief flags it in the return's `deviations`. Rule each one in
or out **on the record** — the ledger row's "deviations ruled" field (step 3). Silently
absorbing a deviation is a defect.

## 9. Hold at the gates

The loop stops at fixed points, and honoring them is what keeps a long run from drifting:

recon → deliver a decision-complete plan (WIRING) → **HOLD** for ratification → build → hand
over **uncommitted** → the agent that verifies commits.

An executor never commits its own work; the plan→build handoff is decision-complete so the
executor makes no call the plan didn't ([`council.md`](../../coordination/council.md)).

## Roles: build and verify are different agents

Two lanes, kept structurally separate ([`council.md`](../../coordination/council.md),
[`review.md`](../../coordination/review.md)):

- **Builder** — implements one slice end-to-end against its brief; may modify only the files in
  its fence. After completion, diff `git diff --name-only` against the fence; a touched file
  outside the fence is a violation to flag and escalate, never to auto-revert.
- **Verifier** — checks a slice it did **not** build. A read-only role must be read-only by
  capability, not by politeness: declare `disallowedTools: Write, Edit` in its definition (the
  agents primitive, [`framework/primitives/agents/`](../../primitives/agents/)) so it *cannot*
  mutate what it assesses.

## Failure budget

Review is bounded so it cannot ping-pong forever ([`review.md`](../../coordination/review.md)):

- A verify failure returns the slice to its owner; the round count increments.
- On retry, append the failure evidence to the brief; consider narrowing scope.
- **Two rounds that do not converge escalate to the operator** — a real disagreement, not a
  mechanical one. Never silently retry past the cap; never skip a failed slice.

## Model tier per slice

Route each slice to a tier by its difficulty and risk, and record the choice — do not hardcode
a model name here (names go stale; the concern is the routing rule). Deep architecture,
high-stakes analysis, and ambiguous debugging want the strongest reasoning tier; bulk research,
summarization, and mechanical transforms route to a cheaper one. A node declares a generic
`model_tier` and `effort`; the [model-tier-routing standard](../../standards/model-tier-routing/)
enforces the vocabulary, and the [model-router skill](../model-router/) carries the decision
matrix. The concrete tier-to-model resolution is instance data.

## Context discipline

- **Scout before loading.** Before pulling large docs into context, send a lightweight read-only
  scout to identify which files are actually relevant, then load only those.
- **Progressive disclosure.** Don't front-load every instruction and tool; discover and load
  detail as the task demands it.
- **Externalize state.** Plans, the synthesis ledger, and progress live in files (step 3), not
  in the window — that is what survives compaction.

## Verify a loop run

The loop's outputs are its proof, each against a gate that already exists — build no new harness:

- **Briefs and returns** → the worker-brief validator
  ([`framework/primitives/worker-brief/`](../../primitives/worker-brief/)).
- **The sequencing spine** → the orchestration-manifest standard
  ([`framework/standards/orchestration-manifest/`](../../standards/orchestration-manifest/)).
- **The whole run** → the trajectory-eval standard
  ([`framework/standards/trajectory-eval/`](../../standards/trajectory-eval/)): the run's spans
  and files are one trajectory, scored against a pinned baseline.

The full seeded, no-steering dry-run is a **manual live-fire** (it needs a real model run), and
it doubles as the cross-version parity benchmark. `examples/` holds a seeded
manifest and a seeded dispatch brief that pass their gates as a concrete starting point.

## Anti-patterns

- **A second brief format.** Never hand-roll a bespoke agent-contract block — the worker-brief
  primitive is the one schema and the one code path (step 6).
- **A loop validator.** The loop is prose discipline; its artifacts are what's checkable.
  Inventing a validator for the loop itself is theater.
- **Grading your own homework.** The agent that built a slice does not verify it; probe with
  red inputs outside the worker's own harness.
- **Unsupervised writers.** Never let a builder's output ship without a separate verify pass.
- **Auto-revert on a fence violation.** Flag and escalate; a human decides — the orchestrator
  does not know what the worker was mid-doing.
- **Credential exposure.** Never place secrets in a brief; reference an env var or secrets
  manager.
- **Lethal trifecta.** Never combine private-data access, untrusted input, and an exfiltration
  vector in one agent without a human in the loop.

## Output

The run's **`closeout.json`** — a synthesized result assembled from the slice ledger: per slice,
its status, verify evidence, ruled deviations, and the commit that carried it, with each
contribution attributed to the worker that produced it, plus any found-defect findings and
`precedent-applied` records (steps 4 and 7).
It is JSON — the operator-facing counterpart to the `decision-ask.json` the gate emitted, a
structured artifact, not a prose report.
