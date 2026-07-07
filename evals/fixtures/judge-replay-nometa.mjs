// judge-replay-nometa.mjs — SELF-VERIFY NEGATIVE for the T5 provider-metadata gate. Returns "pass"
// for every dimension but deliberately omits the `meta` export. In cert mode score.mjs must
// DISQUALIFY it (a provider that does not declare the context it closes over cannot certify parity).
// Proves the meta shape check bites; run with --allow-deferred it would be moot (meta is a cert-mode
// requirement only).
export default async function judge(_input) {
  return "pass";
}
