// lib/record.mjs — the pure run-record builder + redactor. No I/O, no real clock: the entry
// (../sink.mjs) supplies the clock and the file, so this is deterministic and assertable like
// scheduler/lib/select.mjs. The fields are the observability standard
// (framework/doctrine/standards/observability.md); the redaction obeys data-handling.md.

import { createHash } from "node:crypto";

/** sha256 sliced to 12 hex — enough to correlate identical reasons, reveals nothing of the call.
 *  Same technique as standards/tool-gate/lib/audit.mjs; copied (not imported) to keep runtime/ standalone. */
export function reasonHash(reason) {
  return createHash("sha256").update(String(reason ?? "")).digest("hex").slice(0, 12);
}

/** Redact gate decisions to {decision, rules, reason_hash} ONLY — the raw reason/command/path never
 *  enters the record. A pre-hashed reason_hash is preserved; a raw reason is hashed here. */
export function redactGateDecisions(decisions) {
  if (!Array.isArray(decisions)) return [];
  return decisions.map((d) => ({
    decision: String(d?.decision ?? ""),
    rules: Array.isArray(d?.rules) ? d.rules.map(String) : [],
    reason_hash: d?.reason_hash ?? reasonHash(d?.reason),
  }));
}

/** Build a typed run-record. `now` (a Date) is injected so the builder stays pure/deterministic.
 *  Optional measured fields (duration/tokens/cost/metadata) are included only when supplied. */
export function buildRunRecord(input = {}, now) {
  const rec = {
    ts: (now ?? new Date()).toISOString(),
    task_id: String(input.task_id ?? ""),
    slice: String(input.slice ?? ""),
    model: String(input.model ?? ""),
    effort: String(input.effort ?? ""),
    attempts: Number.isInteger(input.attempts) ? input.attempts : 1,
    verify: {
      first_pass: !!input.verify?.first_pass,
      result: input.verify?.result === "pass" ? "pass" : "fail",
    },
    gate_decisions: redactGateDecisions(input.gate_decisions),
  };
  if (input.duration != null) rec.duration = Number(input.duration);
  if (input.tokens != null) rec.tokens = input.tokens;
  if (input.cost != null) rec.cost = Number(input.cost);
  if (input.metadata != null) rec.metadata = input.metadata;
  return rec;
}
