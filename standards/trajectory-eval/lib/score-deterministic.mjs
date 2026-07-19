// lib/score-deterministic.mjs — the deterministic floor. Pure, no model, no I/O. It scores only
// what the spans permit an exact answer on: the tool-path (edit distance vs the baseline path),
// verification discipline (every mutation followed by a verify), question economy (paused-to-user
// stops), and fan-out structure. Everything requiring taste — plan adherence, synthesis fidelity,
// whether an "ask" was actually undiscoverable — is NOT here; it is the judge layer (score-judge.mjs).
// Deterministic-first is the law: never spend a judge call on a criterion a diff can decide.

import {
  askToolsOf,
  efficiency,
  fanOut,
  mutationVerification,
  operatorAsks,
  planApprovals,
  planApprovalToolsOf,
  toolPath,
} from './trajectory.mjs';

/** Levenshtein edit distance over two token arrays (not characters — tool names are the tokens). */
export function levenshtein(a, b) {
  const m = a.length,
    n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Tool-path similarity in [0,1]: 1 = identical sequence, 0 = fully divergent. Two empty paths → 1. */
export function toolPathScore(candidatePath, baselinePath) {
  const maxLen = Math.max(candidatePath.length, baselinePath.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(candidatePath, baselinePath) / maxLen;
}

/** Verification discipline in [0,1]: share of mutation spans followed by a verifying span.
 *  No mutations → 1 (nothing to verify, vacuously disciplined). */
export function verificationDiscipline(trajectory) {
  const { mutations, verified } = mutationVerification(trajectory);
  return { mutations, verified, score: mutations === 0 ? 1 : verified / mutations };
}

/**
 * Compute the full deterministic metric block for one trajectory. `baseline` is optional; when
 * present the tool-path is scored against the baseline's path (otherwise tool_path_score is null),
 * and the baseline supplies the operator-ask / plan-approval tool vocabulary that question-economy
 * counts against — without a baseline vocabulary operator_asks is ungateable.
 */
export function computeDeterministic(trajectory, baseline = null) {
  const path = toolPath(trajectory);
  const ver = verificationDiscipline(trajectory);
  return {
    tool_path: path,
    tool_path_score: baseline ? toolPathScore(path, toolPath(baseline)) : null,
    verification: ver,
    operator_asks: operatorAsks(trajectory, askToolsOf(baseline)),
    plan_approvals: planApprovals(trajectory, planApprovalToolsOf(baseline)),
    fan_out: fanOut(trajectory),
    efficiency: efficiency(trajectory),
  };
}
