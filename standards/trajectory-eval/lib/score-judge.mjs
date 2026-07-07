// lib/score-judge.mjs — the judge layer, reached ONLY for dimensions a diff cannot decide. Pure
// except for the injected `provider` (the instance's model endpoint); with no provider every judge
// dimension returns gradeable:false, exactly as the deterministic harness skips a judge-required
// eval. The provider never sees a raw model name — it is the portability seam, mirroring
// eval-harness's runHarness({provider}).
//
// Bias controls are structural, not optional: each dimension is judged twice with the two runs in
// swapped order (candidate-first, then baseline-first) and the verdict only counts when both
// presentations agree — the order-swap the judge-bias gate requires. Disagreement escalates
// (gradeable:false, escalate:true) rather than silently taking one side.

// The taste dimensions the spans alone cannot settle. Names are stable — the judge-gate and any
// rubric reference them.
export const JUDGE_DIMENSIONS = [
  "plan_adherence", // did the run follow the phases the baseline exemplifies?
  "synthesis_fidelity", // is the returned conclusion supported by what the tools actually surfaced?
  "finding_class_coverage", // were the finding classes the baseline expects all reached?
  "question_discoverability", // were paused-to-user stops truly undiscoverable, or answerable in-context?
  "verification_adequacy", // was the verification real (right target) or a proxy that looks disciplined?
  "artifact_set", // were the specific expected artifacts produced (spans carry tool, not file path)?
];

/**
 * Score the judge dimensions of candidate vs baseline.
 *   provider: async ({dimension, candidate, baseline, presentation}) => "pass" | "fail"
 *             presentation is "candidate-first" | "baseline-first" so the caller can neutralize order.
 *   No provider → every dimension is gradeable:false (judge-required, not run here).
 * Returns {gradeable, dimensions:{<name>:{...}}, escalations:[...]}.
 */
export async function scoreJudge({ candidate, baseline, provider, dimensions = JUDGE_DIMENSIONS }) {
  if (typeof provider !== "function") {
    const out = {};
    for (const d of dimensions) out[d] = { gradeable: false, reason: "judge-required (no provider configured)" };
    return { gradeable: false, dimensions: out, escalations: [] };
  }

  const out = {};
  const escalations = [];
  for (const d of dimensions) {
    const first = await provider({ dimension: d, candidate, baseline, presentation: "candidate-first" });
    const second = await provider({ dimension: d, candidate, baseline, presentation: "baseline-first" });
    const consistent = normalize(first) === normalize(second);
    if (!consistent) {
      out[d] = { gradeable: false, escalate: true, verdicts: [first, second], reason: "order-swap verdicts disagree" };
      escalations.push(d);
    } else {
      out[d] = { gradeable: true, verdict: normalize(first), consistent: true };
    }
  }
  return { gradeable: escalations.length === 0, dimensions: out, escalations };
}

function normalize(v) {
  const s = String(v).trim().toLowerCase();
  return s === "pass" || s === "fail" ? s : "fail";
}
