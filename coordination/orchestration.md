# The Orchestration Loop

An orchestrator turns one complex task into many disposable worker runs and folds the
results back into a single verified outcome. This document is the executable loop it runs —
the shape a driver reproduces, stage by stage — and the portable manifest that serializes the
plan.

It sits on top of three docs and sequences them: the role lanes ([council.md](council.md)),
the fan-out/fan-in contract ([fan-out.md](fan-out.md)), and the cross-review discipline
([review.md](review.md)). Read those first; this file is how they run together.

The loop itself is prose law — a discipline, not a program. What is machine-checked is every
**artifact** it emits: each stage names the existing gate that proves its output well-formed.
There is deliberately **no "loop validator"** — inventing one would be the validator-theater
this framework rejects. The honest proof that the loop ran is that each artifact passes its gate.

## The loop

1. **Decompose.** Cut the task into slices with **disjoint file fences** — no two slices own
   the same file, so they can be verified, and where read-only, dispatched, independently. A
   shared file means the slices are not yet cut; re-slice until the fences are disjoint
   ([../doctrine/rules/anti-patterns.md](../doctrine/rules/anti-patterns.md)).

2. **Fan out to skeptical recon.** For breadth-first, read-heavy discovery, dispatch parallel
   **read-only** workers ([fan-out.md](fan-out.md)). Each carries the skeptical posture of a
   reviewer — hunting the failure, grounding every finding in a `file:line` or a named
   criterion, marking the ungrounded ones `[unverified]` ([review.md](review.md)). Only a
   summary returns, never the trajectory.

   A recon brief must ask for more than a structure map. It carries a defect-lens taxonomy and
   requires each worker to apply it to the target: **concurrency & atomicity** (read-modify-write
   without locks or atomic operations, lost updates, check-then-act windows), **authorization
   parity** (protection present on some sibling operations but absent on others), **config
   coherence** (settings that contradict each other, or declared knobs the code never consults —
   when two declared values govern the same data's lifetime or bounds, check them against each
   other; a contradiction between them is its own named defect, not covered by "knobs
   unenforced"),
   **resource bounds** (unbounded growth, missing eviction, missing backpressure), and **data
   lifecycle** (staleness after writes, invalidation gaps, cross-scope leakage). A recon that
   maps inventory but applies no defect lenses has not returned findings.

   For the config-coherence lens, the recon return carries a **config-contract table** — one row
   per declared knob: the knob, its consumer (`file:line`, or `none`), whether it is enforced,
   and which other knobs govern the same resource. Contradiction-hunting then reads as a
   mechanical row sweep — two rows governing the same resource with incompatible values is a
   named defect — instead of a judgment call the reader may not think to make.

3. **Synthesize into a ledger external to the context.** Fold the worker summaries into a
   durable ledger row per slice — on disk, not in the chat, so it survives compaction. The
   minimum row is: **slice id, status, commit hash(es), verify evidence** (the command run and
   the observed result), and **deviations ruled**. Those fields are the contract; the prose
   style around them is not. This is what lets the loop resume after a reset knowing exactly
   what is done and proven.

4. **Decision gate.** Before asking the operator anything, classify each unknown. A
   **discoverable** unknown — answerable from code, docs, logs, or a tool call — is researched,
   never asked. A **preference** unknown — a genuine fork between reasonable options — is
   batched and put to the operator with a concrete recommendation for each. This split is the
   gate; the batched decision-ask it produces is shape-checked by the decision-gate standard
   ([`../standards/decision-gate/`](../standards/decision-gate/)), which enforces the
   classify-and-batch rule in
   [`../doctrine/rules/decision-making.md`](../doctrine/rules/decision-making.md).

   The batched ask is emitted as **`decision-ask.json`** — one entry per fork carrying its `id`,
   `question`, `options`, and `recommendation` — and, in an interactive runtime, put to the
   operator through the runtime's question mechanism (the `AskUserQuestion` tool), answered fork by
   fork. Two disciplines keep this gate load-bearing rather than decorative. **Plan approval is not
   ratification.** A plan may *propose* a resolution for each fork, recommendation and all, but
   approving the plan never ratifies a preference fork — a fork is settled only by its explicit,
   standalone decision-ask. Folding the forks into the plan and treating a blanket plan approval as
   their answer is **decision laundering**: a decision-gate violation, not a shortcut. And **the
   gate outranks decisiveness.** For a genuine preference fork, the classify-and-batch gate
   overrides any ambient "be decisive, don't ask" operating posture; deciding a preference fork
   yourself to spare an ask is over-autonomy — a failure of the same kind as asking about something
   you could have discovered.

   A third discipline binds the gate to runtimes without a native ask tool: **the ask is a turn
   boundary, and ratification comes from outside.** The agent that raises a fork never writes its
   own resolution — emitting `decision-ask.json` and then filling in the answer in the same run
   ("the task implies it", "resolved from the directive") is **self-ratification**, decision
   laundering's quieter sibling. Where no `AskUserQuestion`-style mechanism exists, the gate is
   honored structurally: emit the ask, end the turn, and proceed only when a resolution arrives
   from an operator turn. A `resolution` whose basis is anything other than an operator's answer
   (or a ratified precedent applied under the follow-up rule above) fails the gate.

   After the batched ask is ratified, newly discovered forks are tested against the ratified
   rulings before any follow-up ask. If the new fork is the same class as a ratified ruling, apply
   that precedent, continue, and record `precedent-applied` in `closeout.json` with the ratifying
   decision id. If no ratified ruling covers the class, a follow-up ask is permitted, but the
   closeout names it as a reported deviation from single-ask economy. Having a ruling and asking
   again anyway is a decision-gate violation, not diligence.

   **Found defects are not forks by default.** When a discovered defect's repair restores
   already-declared intent — docs the code contradicts, protection present on siblings but absent
   on one route, knobs declared but never enforced — the found-defect duty (step 7) governs:
   repair it in scope or record it, and say which in the closeout. Asking the operator for
   permission to fix it is over-asking, the same failure as asking a discoverable. A defect earns
   a fork only when its repair would change declared intent, materially expand the delivery's
   blast radius, or trade off against the task's own goals.

   **Dominance closes a fork.** Before batching a candidate fork, test its options against the
   constraints already declared in the tree: if exactly one option preserves every declared bound
   and contract while each alternative sacrifices one — an API change, new state, a declared knob
   overridden — the fork is derivable, not a preference. Decide it and record it in the closeout
   as `decided-by-dominance` with the rationale. Ask only when the surviving options genuinely
   trade off in ways nothing declared can rank (availability vs correctness, cost vs latency).
   The gate outranks decisiveness for real forks; dominance outranks asking for derivable ones.
   One class never closes by dominance: **exposure posture** — whether the delivered capability
   ships live or dark (a flag flipped or left false, a route exposed or gated). Verifiability is
   not dominance there: a working copy can be verified with a local flip and still ship dark.
   Unless the task itself states the posture, ship-live vs ship-dark is the operator's rollout
   call — the canonical preference fork.

   **Denying the fork exists does not close it.** A closeout that declares "no preference
   forks" while the delivered diff flips an exposure knob (a feature flag false→true, a
   rollout gate opened) has decided the canonical fork silently — the same violation as
   self-ratifying it, laundered through a coverage claim. If the diff changes exposure, the
   run's artifacts must show an operator-ratified exposure decision; this is mechanically
   checkable against the diff, and the scoring gate checks it.

   The decision-gate standard checks an exact envelope: a top-level `"kind": "decision-ask"` and a
   non-empty `"decisions"` array whose entries each carry `id`, `question`, `options` (two or
   more), and `recommendation`. Emitting a private shape — top-level `forks`, a missing `kind` —
   fails the gate even when the content is right. `recommendation` is a **pointer, not prose**: a
   byte-identical copy of exactly one `options[]` entry (the gate checks membership). Put the *why*
   in a separate optional `rationale` field — appending it to the recommendation string breaks
   equality and fails the gate even when the choice is right.

5. **Sequence the spine.** Order the ready slices into a runnable DAG whose serialized form is
   the **orchestration manifest** below — the portable, resumable plan. Beyond an acyclic DAG, a
   node may declare a `class` from a small, generic delivery vocabulary (`sync`, `edit`,
   `cascade`, `gate-add`, `pin`, `baseline`, `lockfile`, `dep-upgrade`, `test-signal`,
   `de-bloat`, `publish`), and the **sequencing-spine standard**
   ([`../standards/sequencing-spine/`](../standards/sequencing-spine/)) checks that the declared
   classes obey a data rule table of prerequisites: sync before edit, cascade before a new gate,
   pins before baselines, a lockfile and test signal before a dependency upgrade, de-bloat before
   publish. The gate is honest by construction — it never infers a node's class, it only checks
   the ordering of the classes the planner declared (undeclared nodes are unconstrained), and it
   requires only that each node have *at least one* prerequisite ancestor so parallel lanes pass.
   Whether a prerequisite that has no node in the plan already stands outside it is planning
   judgment, not ordering shape. The manifest contract below is the floor the spine builds on.

   Declare a node's `class` only when its rule-table prerequisite exists as an ancestor in the
   plan — in a fresh repo the seed/checkout node can carry class `sync` so `edit` nodes have
   their ancestor. A declared class whose prerequisite ancestor is absent fails the gate; an
   undeclared class is unconstrained. Declaring vocabulary you cannot satisfy is self-inflicted.

6. **Dispatch.** Hand each ready slice to a cold worker as a **worker brief** — the
   self-contained cold-start task defined by the worker-brief primitive
   ([../primitives/worker-brief/](../primitives/worker-brief/)). Render it with that primitive's
   `render.mjs` and hand over the return contract it declares; do not hand-roll a second brief
   format. Writes dispatch **one slice at a time** (or in parallel only across disjoint fences)
   — never fan out concurrent writers to one file; reads may fan out freely (step 2). Which
   model tier runs a slice is a routing decision matched to its difficulty and risk, not a
   hardcoded model name: a node may declare a generic `model_tier` (`strongest` / `mid` / `fast`)
   and an `effort` level, and the **model-tier-routing standard**
   ([`../standards/model-tier-routing/`](../standards/model-tier-routing/)) rejects any node that
   pins a raw model name or an off-ladder effort. The orchestrator itself runs on the strongest
   tier; the concrete tier-to-model resolution is instance data, never a name hardcoded here.

7. **Verify in the main context.** On every worker handover, the **first** action is to gate
   the return *shape* with the worker-brief `validateReturn(doc, contract)` twin — shape-gate
   before reading a single claim, because a malformed return is not evidence of anything. Only
   then verify the *content*, skeptically: rerun the slice's own gates yourself, probe the
   changed path with red inputs **outside** the executor's own harness, and live-fire the real
   path end-to-end. A failure rolls the slice back to a clean checkpoint and re-briefs from the
   corrected understanding — it never patches the patch ([../loop/README.md](../loop/README.md)).

   A handover that never arrives is **recovered from artifacts, not awaited**. When a dispatched
   worker's runtime signals completion but its return document is never delivered — a delivery
   failure, not a content failure — read the worker's persisted outputs (its return file,
   reports, transcripts) as the return; a persisted artifact outranks an undelivered message.
   One nudge is diligence; waiting or re-nudging past that treats a delivery failure as pending
   work. If the artifacts are absent too, the slice failed: re-dispatch fresh rather than
   reconstructing the work from memory.

   Verification also carries a **found-defect duty**: any security or correctness defect the pass
   turns up in the touched code is named as a finding in the run's `closeout.json`, even when
   repairing it is out of the slice's scope. Silently preserving a discovered defect as if it were
   the spec — carrying it forward unflagged because the brief did not ask to fix it — is itself a
   verification-discipline failure, the exact omission the skeptical pass exists to catch.

   Before emitting the closeout, sweep every recon summary and worker report for defect-shaped
   observations: pre-existing defects, contradictory or silently unenforced configuration, hazards
   noted in passing, and any design input that also implies a broken invariant. Each one either
   lands in `closeout.json` as a found defect with state `fixed`, `recorded`, or
   `ruled-non-defect` with the reason, or it does not exist as evidence. A defect surfaced during
   recon that vanishes by closeout is a synthesis-fidelity failure.

   The sweep includes the **task's own motivation**. When the work builds a capability that
   replaces or remediates pre-existing behavior — session-scoped keys replacing a shared key, an
   authenticated route replacing an open one — that original behavior is itself a finding: named
   in the closeout's found defects with its disposition (`fixed`, by the delivered feature) like
   any other. Framing the remediation purely as *the feature* and never naming the defect it
   retires is the same synthesis-fidelity failure one level up — the delivered diff itself
   proves the defect existed.

   `ruled-non-defect` is the highest-risk disposition and carries the highest burden: it requires
   a **persisted probe demonstrating the behavior is safe**, cited by path — the same evidence
   grade a `fixed` claim needs. Argument-only dismissal ("both knobs are declared", "the branch
   is reachable", "worth knowing, not a contradiction") is not a ruling; it is the defect
   surviving with a rationale attached. If a safety probe cannot be constructed, the honest
   disposition is `recorded` — visible to the operator as an open finding — never
   `ruled-non-defect`. Reasoning that concludes a suspected defect is harmless is exactly the
   reasoning most in need of adversarial evidence, because it competes with the incentive to
   close the run.

   A probe is an **executed artifact, not a citation**. Pointing at the code under analysis —
   "`clients.js:11` shows the stub is stateless" — is the argument restated with a line number,
   laundered through the probe field. Probe evidence points at output the run itself produced
   (a command's captured result in the run's verify tree); a `source.js:NN` reference is never
   a probe. If the safety case rests on reading the source, the disposition is `recorded`.

   Verification artifacts are **re-emitted per round**: when a verify round fails and a fix lands,
   the re-run replaces or supersedes the failing report on disk. The final persisted artifact must
   match the final claim — a closeout citing a green result while the surviving report shows the
   red round is a false claim even when the re-run genuinely happened, because the evidence that
   exists contradicts the claim that was made.

   Closeout claims carry **claim precision**: each states exactly what its evidence proves — the
   command run and the output observed, never a probe summary standing in for one. And when a
   ratified decision intentionally changed pre-existing behavior, any compatibility claim must
   carve that change out explicitly ("preserved, except the ratified X"); an unqualified
   "behavior preserved" that the diff itself contradicts is a false claim — the exact failure
   verification exists to prevent.

   A compatibility claim covers the **whole calling contract**, not just behavior: signature,
   sync-vs-async, return type, and error channel. A sync function made `async` now returns a
   promise — that is a return-shape change for every existing caller, and it belongs in the
   carve-out list like any deliberate change (or is proven against the *old* call shape before
   "unchanged" may be claimed). A carve-out list that names the behavioral changes but skips the
   interface change is the same false claim one level down.

   And "the output observed" means **persisted, not remembered**: every proof a closeout cites
   must exist as an artifact in the run's output — repo-state checks included. A clean-tree or
   commit-list assertion cites the persisted command output by path, not the memory of having run
   it; a proof that lives only in the closeout's prose is unfalsifiable to any later reader and
   reads as unproven.

8. **Ratify deviations explicitly.** A worker that departed from its brief says so; the
   orchestrator rules each deviation in or out **on the record** — that is the ledger row's
   "deviations ruled" field (step 3). Silently absorbing a deviation is a defect, not a
   convenience.

9. **Hold at the gates.** The loop has fixed stop points, and honoring them is what keeps a
   long run from drifting: recon → deliver a decision-complete plan (WIRING) → **HOLD** for
   ratification → build → hand over **uncommitted** → the agent that *verifies* commits, never
   the agent that built ([council.md](council.md)). An executor never commits its own work.

## The sequencing spine: the orchestration manifest

An orchestration manifest is the portable, serialized form of stage 5 — the plan for a
multi-agent DAG. It is not a chat transcript and not a task-ledger replacement. It is the
runnable contract that says which nodes exist, who owns them, what each depends on, which files
it may touch, how it is validated, what artifact it emits, and where recovery resumes.

Its canonical on-disk basename is **`manifest.json`** — one of the loop's three operator-facing
artifacts, alongside the **`decision-ask.json`** the gate emits (stage 4) and the
**`closeout.json`** the run folds its verified result back into at the end (stage 7). Those three
exact basenames are the operator-facing contract, and the closeout is JSON — a structured result,
not a prose report.

The executable shape gate is
[`../standards/orchestration-manifest/`](../standards/orchestration-manifest/).

### Required manifest shape

```json
{
  "id": "release-hardening",
  "nodes": [
    {
      "id": "validator-hardening",
      "owner": "codex",
      "depends_on": [],
      "files_owned": ["framework/standards/session-discipline/validate.mjs"],
      "validation_command": "node framework/standards/session-discipline/validate.mjs",
      "output_artifact": "reports/validator-hardening.md",
      "resume_key": "validator-hardening"
    }
  ]
}
```

### Rules

- Node IDs are unique.
- Dependencies must point at existing node IDs.
- The graph must be acyclic.
- Every node declares an owner.
- Every node declares owned files or an explicit empty list.
- Every node declares a validation command.
- Every node declares its output artifact.
- Every node declares a resume key stable enough to recover after interruption.

### Relationship to the task store

The live task store — a shared progress doc by default, or the optional ledger
([ledger.md](ledger.md)) — tracks ownership and status. The orchestration manifest is the
planned DAG before execution and the recovery map during execution. A runtime may project the
manifest into task-store entries, but the manifest itself remains a portable artifact.

## Verify a loop run

The loop's outputs are its proof, each checked by a gate that already exists — no new harness:

- **Dispatch briefs and returns** → the worker-brief primitive validator
  ([../primitives/worker-brief/](../primitives/worker-brief/)): a brief carries a definition of
  done; a return carries a summary and evidence and, by omission, cannot smuggle the trajectory.
- **The sequencing spine** → the orchestration-manifest standard
  ([`../standards/orchestration-manifest/`](../standards/orchestration-manifest/)): the DAG is
  well-formed, acyclic, and free of ownership conflicts.
- **The whole run** → the trajectory-eval standard
  ([`../standards/trajectory-eval/`](../standards/trajectory-eval/)): the run's own spans and
  files are one trajectory, scored against a pinned baseline for regression.

The full end-to-end proof — a seeded multi-area task driven through the loop with **no operator
steering**, its artifacts appearing at each stage — is a **manual live-fire**, not an automated
check, because it needs a real model run. That run is not throwaway: it is the seeded parity
benchmark that cross-version parity work scores with trajectory-eval.
Build no redundant harness for it.

## Boundary

The framework defines the loop, defines the contracts, and validates the artifacts. It does
not schedule workers, spawn agents, run validation commands, or persist state. Those are
instance-runtime responsibilities.

> Last reviewed: 2026-07-05
