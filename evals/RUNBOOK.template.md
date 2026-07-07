# RUNBOOK Template — Parity Candidate Run

This is the no-steering protocol. The same steps produce the private golden and every candidate
scored against it. Only the driver model and baseline role differ.

## Roles
- **Golden producer** — `<golden-producer-model>` clean run. Its promoted trace becomes the baseline.
- **Certification target** — `<certification-target>`. Passing here is the exit signal.
- **Upper control** — `<upper-control>`. Expected to clear parity as an instrument check.

## Protocol
1. **Fresh session, throwaway fixture.** Start a clean session with no prior context. Copy only
   `<fixture-dir>/` plus `<task-file>` to a throwaway working directory. The throwaway must never
   contain `<answer-key>`, `<goldens-dir>/`, or any golden trace corpus.
2. **Provision telemetry in the throwaway.** Project-scoped hooks do not follow a plain file copy.
   At seeding time, add the instance's telemetry hook/config to the throwaway. Driver sessions must
   emit spans organically. If a completed session has no live emission, backfill it from transcripts
   with the instance's export tooling and mark the scorecard accordingly.
3. **Set the driver model** at session start: `<driver-model>`. The driver is the orchestrator;
   dispatched workers keep their own per-agent models.
4. **Hand over only `<task-file>`** and invoke the orchestrator workflow on it. No other
   instructions, hints, or benchmark coaching.
5. **No-steering rule.** The operator answers only the single batched decision ask, using the
   ratified choices in `<answer-key>` `preference_forks`, and nothing else. If the driver asks a
   discoverable question, the operator does not answer it; the run is a violation.
6. **Capture the trace id** for export.
7. **Export the trajectory** with the fixed task fingerprint:
   ```bash
   <trajectory-export-command> <trace-id> \
     --fingerprint <task-fingerprint> \
     --model <driver-model> \
     --agent-type <orchestrator-type> > candidate.trajectory.json
   ```
8. **Collect emitted artifacts from the throwaway output.** Copy the run-produced
   `manifest.json`, `decision-ask.json`, and `closeout.json` into a bundle dir. Do not hand-author
   or borrow them. Save the working-copy diff as `fixture.diff` with user ignore files disabled:
   ```bash
   git -c core.excludesFile=/dev/null add -N .
   git diff > fixture.diff
   ```
   This collection is the run-binding. The scorer's target-path write-span check is a secondary net
   that only bites when the export carries tool-input target paths.
9. **Collect cited evidence artifacts** into an `evidence/` dir beside the bundle. Include ledgers,
   verify reports, worker returns, or any files the closeout cites. Export the dir as
   `PARITY_EVIDENCE_DIR` so the judge provider packs it.
10. **Score with a real judge provider:**
    ```bash
    node framework/evals/score.mjs candidate.trajectory.json \
      --baseline <golden-baseline> \
      --artifacts <bundle-dir> \
      --fixture-diff <bundle-dir>/fixture.diff \
      --provider <judge-provider>
    ```

## Run-Day Judge Provider
Copy `framework/evals/judge-provider.skeleton.mjs` to an instance-local `judge-provider.mjs`. Keep
the factory shape:

```js
import { makeJudgeProvider } from "./judge-provider.mjs";

const provider = makeJudgeProvider({
  answerKey,
  bundleDir,
  fixtureDiff,
  annotations: baseline.annotations,
});
```

Replace `askModel()` with the instance's judge endpoint. Keep
`export const meta = { context: ["answer-key", "artifacts", "fixture-diff"] }`; certification mode
disqualifies a provider that does not declare the context it closes over.

The skeleton packs `PARITY_EVIDENCE_DIR` into each judge packet. Missing `manifest.json`,
`decision-ask.json`, or `closeout.json` is represented as `{ ABSENT: "<file> was never emitted by
this run" }` so the judge sees absence as evidence, not a fabricated artifact.

## Producing the Golden
Run the same protocol with `<golden-producer-model>`, then promote only after this checklist passes:

1. All expected finding classes are surfaced in the closeout, checked against `<answer-key>`.
2. The single operator ask is a genuine preference fork; no discoverable fact was asked.
3. The emitted artifacts and fixture diff are frozen alongside the trajectory.
4. Provenance names the actual driver model used to produce the golden.

Promotion attaches `<baseline-meta>` to the exported trajectory:
```bash
<trajectory-export-command> <trace-id> \
  --fingerprint <task-fingerprint> \
  --model <golden-producer-model> \
  --baseline-meta <baseline-meta> > <golden-baseline>
```

Self-scoring a trace against itself only proves the instrument loads. It is not the promotion gate;
independent review against the answer key is the gate.

## Iterate
A failed candidate is a signal about the target workflow, not the benchmark. Fix the workflow and
rerun. Changing the benchmark to make a candidate pass invalidates the measurement.
