// judge-replay-fail-coverage.mjs — a canned judge provider for score.mjs SELF-VERIFICATION only.
// Returns "fail" for finding_class_coverage (a candidate that missed a seeded finding class) and
// "pass" for every other dimension. Proves score.mjs surfaces a judge-side (c) failure as a hard
// parity fail. Verdict is presentation-independent so it stays gradeable (no escalation).
// meta declares the cert-mode context contract (T5); this is a canned self-verify stand-in.
export const meta = { context: ["answer-key", "artifacts", "fixture-diff"] };

export default async function judge({ dimension }) {
  return dimension === "finding_class_coverage" ? "fail" : "pass";
}
