#!/usr/bin/env node
// render.mjs — compose a worker brief into the dispatch prompt text, and check a worker's return
// against the brief's contract. This is the seam an orchestrator (e.g. the 7.1 fan-out playbook)
// imports so it consumes the primitive directly instead of reimplementing the cap check. Pure, no
// I/O, no npm — deliberately light so it can run at dispatch time; the authoritative build-time
// schema check is validate.mjs (ajv). Both enforce the same rules; the validator selftest proves
// they agree and that these allowlists have not drifted from worker-brief.schema.json.

// The return envelope, kept in lockstep with worker-brief.schema.json $defs.return.properties.
// A field NOT on this list is rejected — that is how "summary only, never the trajectory" holds:
// there is simply no field for a tool log to live in.
export const RETURN_FIELDS = ["kind", "status", "summary", "evidence", "deviations", "fence_respected", "artifacts", "follow_ups"];
export const REQUIRED_RETURN_FIELDS = ["kind", "status", "summary", "evidence"];
export const RETURN_STATUSES = ["done", "blocked", "needs-input"];

function asLines(value) {
  if (Array.isArray(value)) return value.map((v) => `- ${v}`).join("\n");
  return String(value);
}

/** Compose a brief object into the self-contained prompt text a cold worker receives. Deterministic. */
export function renderBrief(brief) {
  const b = brief || {};
  const out = [];
  out.push(`# Task${b.plan_anchor ? ` — ${b.plan_anchor}` : ""}`, "");
  out.push("## Objective", b.objective || "", "");
  out.push("## Inputs (you start cold — everything you need is here)", asLines(b.inputs), "");
  out.push("## Constraints — do NOT cross these", asLines(b.constraints), "");
  out.push("## Stance", b.stance || "", "");
  if (b.tool_guidance) out.push("## Tool / source guidance", asLines(b.tool_guidance), "");
  if (b.questions && b.questions.length) out.push("## Answer these", asLines(b.questions), "");
  out.push("## Verify bar — your definition of done", b.verify_bar || "", "");
  if (b.hold_point) out.push("## Stop here", b.hold_point, "");
  out.push("## Return contract");
  if (b.return_contract) {
    out.push(`Return a JSON document (kind: "return") carrying: ${b.return_contract.required_fields.join(", ")}.`);
    out.push(`Summary only — never your reasoning trace or tool log. Keep the summary at or under ${b.return_contract.summary_max_chars} characters.`);
  }
  if (b.deviation_policy) out.push("", `Deviations: ${b.deviation_policy}`);
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

/**
 * Check a worker's return against the brief's contract. Lightweight (no ajv): structural shape,
 * summary-only (no field outside the envelope), status enum, and the declared char cap.
 * `contract` is the brief's return_contract (optional — cap is skipped without it).
 * Returns {ok, errors[]}.
 */
export function validateReturn(doc, contract) {
  const errors = [];
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return { ok: false, errors: ["return is not a JSON object"] };
  if (doc.kind !== "return") errors.push(`kind must be "return" (got ${JSON.stringify(doc.kind)})`);
  for (const f of REQUIRED_RETURN_FIELDS) if (!(f in doc)) errors.push(`missing required field '${f}'`);
  for (const k of Object.keys(doc)) {
    if (!RETURN_FIELDS.includes(k)) errors.push(`unknown field '${k}' — returns are summary-only; no trajectory/tool log`);
  }
  if ("status" in doc && !RETURN_STATUSES.includes(doc.status)) errors.push(`status must be one of ${RETURN_STATUSES.join(" | ")}`);
  if (Array.isArray(doc.evidence) === false || doc.evidence.length === 0) errors.push("evidence must be a non-empty array");
  if (typeof doc.summary === "string" && contract && typeof contract.summary_max_chars === "number") {
    if (doc.summary.length > contract.summary_max_chars) {
      errors.push(`summary is ${doc.summary.length} chars, over the declared cap of ${contract.summary_max_chars}`);
    }
  }
  return { ok: errors.length === 0, errors };
}
