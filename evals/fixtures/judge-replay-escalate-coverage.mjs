// judge-replay-escalate-coverage.mjs — a canned judge provider for score.mjs SELF-VERIFICATION.
// It DISAGREES across the order-swap on finding_class_coverage (pass when candidate-first, fail
// when baseline-first), so scoreJudge marks that dimension gradeable:false + escalate:true. Proves
// score.mjs certification mode fails an ESCALATED gating dim (R1: deferred OR escalated = FAIL),
// not only a deferred one. The other dimensions agree (pass) so they stay gradeable.
// meta declares the cert-mode context contract (T5); this is a canned self-verify stand-in.
export const meta = { context: ['answer-key', 'artifacts', 'fixture-diff'] };

export default async function judge({ dimension, presentation }) {
  if (dimension === 'finding_class_coverage')
    return presentation === 'candidate-first' ? 'pass' : 'fail';
  return 'pass';
}
