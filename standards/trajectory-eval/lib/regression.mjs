// lib/regression.mjs — compare a candidate trajectory against a pinned baseline and decide, per
// dimension, pass / regress. Pure, no I/O. This is the cross-version guarantee: rerun the same
// task on a new model or prompt, and a dimension REGRESSES when it drops below the baseline's
// declared threshold OR falls more than the tolerance below the baseline's own score. Only the
// three gating dimensions block; fan-out and efficiency are reported as informational deltas.
//
// Thresholds live on the baseline (thresholds:{}) so the reference run owns the bar it sets; a
// baseline without them falls back to DEFAULT_THRESHOLDS.

import { computeDeterministic } from "./score-deterministic.mjs";

export const DEFAULT_THRESHOLDS = {
  tool_path: 0.7, // min tool-path similarity vs baseline
  verification_discipline: 1.0, // every mutation must be verified
  question_economy_max: 1, // at most this many operator-ask spans
  regression_tolerance: 0.05, // allowed slip below the baseline's own score before it counts as a regression
};

function thresholdsOf(baseline) {
  return { ...DEFAULT_THRESHOLDS, ...(baseline.thresholds || {}) };
}

/**
 * Compare candidate vs baseline. Returns per-dimension records and two verdicts:
 *   floor_pass — the candidate clears every gating threshold on its own,
 *   regressed  — the candidate is materially worse than the baseline on a gating dimension.
 * A run "passes" only when floor_pass && !regressed.
 */
export function compareToBaseline(candidate, baseline) {
  const th = thresholdsOf(baseline);
  const cand = computeDeterministic(candidate, baseline);
  const base = computeDeterministic(baseline, baseline); // baseline scored against itself

  const dimensions = {};

  // tool-path: higher is better, gated by threshold + tolerance vs baseline's own score.
  dimensions.tool_path = gateHigher({
    candidate: cand.tool_path_score,
    baseline: base.tool_path_score,
    threshold: th.tool_path,
    tolerance: th.regression_tolerance,
  });

  // verification discipline: higher is better.
  dimensions.verification_discipline = gateHigher({
    candidate: cand.verification.score,
    baseline: base.verification.score,
    threshold: th.verification_discipline,
    tolerance: th.regression_tolerance,
  });

  // question economy: LOWER is better (fewer operator asks), gated by an absolute max — but only
  // when the baseline declared an ask vocabulary. Undeclared ⇒ ungateable, reported not passed.
  dimensions.question_economy = gateAsks({
    candidate: cand.operator_asks,
    baseline: base.operator_asks,
    max: th.question_economy_max,
    plan_approvals: cand.plan_approvals,
  });

  // informational: reported, never gating.
  dimensions.fan_out = {
    gating: false,
    candidate: cand.fan_out,
    baseline: base.fan_out,
  };
  dimensions.efficiency = {
    gating: false,
    candidate: cand.efficiency,
    baseline: base.efficiency,
    delta: {
      tokens_in: cand.efficiency.tokens_in - base.efficiency.tokens_in,
      tokens_out: cand.efficiency.tokens_out - base.efficiency.tokens_out,
      span_count: cand.efficiency.span_count - base.efficiency.span_count,
    },
  };

  const gating = Object.values(dimensions).filter((d) => d.gating);
  const floor_pass = gating.every((d) => d.meets_threshold);
  const regressed = gating.some((d) => d.regressed);

  return {
    floor_pass,
    regressed,
    pass: floor_pass && !regressed,
    thresholds: th,
    dimensions,
    metrics: { candidate: cand, baseline: base },
  };
}

function gateHigher({ candidate, baseline, threshold, tolerance }) {
  // A score dimension whose baseline threshold is 0 is FULLY ungated: the reference run declares no
  // bar on it, so it is reported informationally and excluded from BOTH floor_pass and regressed
  // (via the gating filter) — never a floor-off-but-regression-on half-gate. Uniform for every
  // higher-is-better dimension (tool_path, verification_discipline); the same sentinel means the same
  // thing on each. (question_economy_max is an absolute cap, not a score threshold, so 0 there means
  // "zero asks allowed" — the strictest gate — and is handled by gateAsks, not here.)
  if (threshold === 0) {
    return { gating: false, direction: "higher-is-better", candidate, baseline, threshold };
  }
  const meets_threshold = candidate >= threshold;
  const regressed = baseline != null && candidate < baseline - tolerance;
  return {
    gating: true,
    direction: "higher-is-better",
    candidate,
    baseline,
    threshold,
    meets_threshold,
    regressed,
    pass: meets_threshold && !regressed,
  };
}

function gateLower({ candidate, baseline, max }) {
  const meets_threshold = candidate <= max;
  const regressed = baseline != null && candidate > baseline; // more asks than the reference run
  return {
    gating: true,
    direction: "lower-is-better",
    candidate,
    baseline,
    max,
    meets_threshold,
    regressed,
    pass: meets_threshold && !regressed,
  };
}

/** Question economy over operator-ask spans. Gateable only when the baseline declared an ask
 *  vocabulary (candidate.gateable): then it is an absolute-max gate on the ask count. Undeclared ⇒
 *  gating:false + status "ask-vocabulary-required", so it neither passes nor fails the floor (the
 *  filter on d.gating excludes it) — a foreign or unvocabularied trace is reported, never vacuously
 *  passed, never reverted to a turn-boundary count. plan_approvals rides along informationally so
 *  the excluded-from-the-gate class is visible. */
function gateAsks({ candidate, baseline, max, plan_approvals }) {
  if (!candidate.gateable) {
    return {
      gating: false,
      status: "ask-vocabulary-required",
      candidate: candidate.count,
      baseline: baseline ? baseline.count : null,
      plan_approvals,
    };
  }
  return {
    ...gateLower({ candidate: candidate.count, baseline: baseline.count, max }),
    plan_approvals,
  };
}
