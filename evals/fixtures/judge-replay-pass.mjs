// judge-replay-pass.mjs — a canned judge provider for score.mjs SELF-VERIFICATION only.
// Returns "pass" for every dimension regardless of presentation, so score.mjs exercises its
// judge-consumption path deterministically without a live model. The order-swap the harness runs
// (candidate-first / baseline-first) agrees trivially, so every dimension is gradeable.
// Run-day scoring supplies a REAL provider instead (see RUNBOOK.md).
//
// meta declares the context a cert-mode provider closes over (T5). This canned self-verify stand-in
// carries the declaration so score.mjs's cert-mode shape check passes; a real provider actually
// closes over these (see judge-provider.skeleton.mjs).
export const meta = { context: ["answer-key", "artifacts", "fixture-diff"] };

export default async function judge(_input) {
  return "pass";
}
