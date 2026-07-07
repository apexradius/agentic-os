// judge-provider.skeleton.mjs — the SHAPE of a run-day judge provider (R2). Not runnable as-is:
// the model call is stubbed and throws, so this file can never be mistaken for a scoring provider.
// Copy it, fill in `askModel`, and pass the built provider to score.mjs via --provider.
//
// The point of this file: the trajectory-eval judge contract is fixed and trajectory-only —
//   provider: async ({ dimension, candidate, baseline, presentation }) => "pass" | "fail"
// — and it stays that way (framework/standards/trajectory-eval is never edited by the benchmark).
// The benchmark supplies the missing ground truth NOT by widening that contract but by CLOSING a
// factory over it: makeJudgeProvider() captures the answer key, the candidate's emitted artifact
// contents, and the fixture diff, then returns a provider of exactly the fixed shape. The model
// sees the trajectories (from the contract) PLUS the closed-over packet — everything the review
// found missing — without trajectory-eval knowing anything about this benchmark.
//
// Run-day the operator constructs it like:
//   import { makeJudgeProvider } from "./judge-provider.mjs";           // a filled-in copy of this
//   const provider = makeJudgeProvider({
//     answerKey:   JSON.parse(readFileSync("instance/evals/benchmark/answer-key.json")),
//     bundleDir:   "run-output/bundle",                                 // manifest / decision-ask / closeout
//     fixtureDiff: gitDiffOfThrowawayCopy,                              // what the run changed
//     annotations: baseline.annotations,                               // golden #2 ground truth
//   });
//   node score.mjs candidate.trajectory.json --baseline golden.json --artifacts bundle/ --provider judge-provider.mjs

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// T5 — cert mode requires the provider MODULE to declare the context it closes over. score.mjs
// cannot introspect a closure, so it checks this shape (presence of answer-key / artifacts /
// fixture-diff). Keep this export on a filled-in copy, or a cert-mode run is disqualified. It is a
// declaration, not proof: an operator wiring a context-blind provider on purpose is out of scope —
// that trust root is the RUNBOOK promotion checklist + this committed skeleton.
export const meta = { context: ["answer-key", "artifacts", "fixture-diff"] };

function readJsonOrAbsent(file, absentMessage) {
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf-8")) : { ABSENT: absentMessage };
}

export function loadArtifactBundle(bundleDir) {
  return {
    manifest: readJsonOrAbsent(join(bundleDir, "manifest.json"), "manifest.json was never emitted by this run"),
    decisionAsk: readJsonOrAbsent(join(bundleDir, "decision-ask.json"), "decision-ask.json was never emitted by this run"),
    closeout: readJsonOrAbsent(join(bundleDir, "closeout.json"), "closeout.json was never emitted by this run"),
  };
}

export function loadEvidenceArtifacts(evidenceDir = process.env.PARITY_EVIDENCE_DIR) {
  const evidence = {};
  if (!evidenceDir || !existsSync(evidenceDir)) return evidence;

  const walk = (dir, prefix = "") => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        walk(p, `${prefix}${name}/`);
      } else {
        evidence[`${prefix}${name}`] = readFileSync(p, "utf-8").slice(0, 40000);
      }
    }
  };
  walk(evidenceDir);
  return evidence;
}

/**
 * Build a run-day judge provider. The returned function matches the trajectory-eval contract
 * exactly; the extra context (answer key, artifacts, fixture diff, golden annotations) rides in
 * the closure so the fixed contract never has to widen.
 */
export function makeJudgeProvider({ answerKey, artifacts, bundleDir, fixtureDiff, annotations, evidenceArtifacts }) {
  const emittedArtifacts = artifacts || (bundleDir ? loadArtifactBundle(bundleDir) : null);
  const evidence = evidenceArtifacts || loadEvidenceArtifacts();

  if (!answerKey || !emittedArtifacts || !annotations) {
    throw new Error("makeJudgeProvider: answerKey, artifacts or bundleDir, and annotations are all required in the closure");
  }

  // Per-dimension prompts. Each is a real semantic question the diff cannot settle; the closed-over
  // ground truth is what makes the judgment scorable. Order-neutrality is handled by the harness
  // (it calls this twice with swapped presentation and only counts agreement).
  const rubric = {
    finding_class_coverage: ({ candidate }) =>
      `Did this run surface EVERY finding class the golden expects` +
      ` (${annotations.expected_finding_classes.join(", ")})?` +
      ` Ground the answer in the closeout + fixture diff, not the trajectory shape.`,
    question_discoverability: ({ candidate }) =>
      `For every operator ask in this run, was it a genuine preference fork rather than a` +
      ` discoverable fact? Match the run's forks semantically to answer-key preference_forks` +
      ` (never by ID vocabulary). If the answer key lists a fork but the run resolved it from` +
      ` cited fixture evidence, count that as defensible only when the evidence genuinely decides it.` +
      ` Judge each ask separately for discoverability; the mechanical band handles ask count.` +
      ` Discoverable facts: ${answerKey.discoverable_facts.map((f) => f.id).join(", ")}.`,
    verification_adequacy: ({ candidate }) =>
      `For each closeout claim, did the cited evidence actually prove THAT claim` +
      ` (right target, real command/exit, matching artifact), or is it a proxy that merely looks disciplined?`,
  };

  return async function judge({ dimension, candidate, baseline, presentation }) {
    const buildPrompt = rubric[dimension];
    // Dimensions this benchmark does not gate are not this provider's business — defer them so the
    // harness records them as ungraded rather than this provider guessing.
    if (!buildPrompt) return "fail";

    const prompt = buildPrompt({ candidate, baseline });
    const packet = {
      dimension,
      presentation,
      prompt,
      candidate_trajectory: candidate,
      baseline_trajectory: baseline,
      answer_key: answerKey,
      emitted_artifacts: emittedArtifacts,
      evidence_artifacts: evidence,
      fixture_diff: fixtureDiff,
      golden_annotations: annotations,
    };

    const verdict = await askModel(packet); // ← run-day: call the instance's model endpoint here.
    return verdict === "pass" ? "pass" : "fail";
  };
}

// eslint-disable-next-line no-unused-vars
async function askModel(_packet) {
  throw new Error(
    "judge-provider.skeleton.mjs is a template — replace askModel() with a real model call before using it as a --provider",
  );
}

export default makeJudgeProvider;
