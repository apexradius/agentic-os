// lib/trajectory.mjs — load, structurally validate, and extract signals from a recorded
// trajectory. Pure: no model calls, no network, no I/O (the CLI reads the file text and passes
// it in; the selftest inlines fixtures). A trajectory is one run: a set of OTel-GenAI spans
// (invoke_agent / chat / execute_tool) under one trace_id, exported from a spans-shaped store.
//
// The schema id is brand-neutral ("trajectory/1") so the artifact ships clean on extraction.

export const SCHEMA_ID = 'trajectory/1';

// Default classifications — a baseline may override via annotations.tool_classes.
export const MUTATING_TOOLS = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit'];
export const VERIFYING_TOOLS = ['Read', 'Bash', 'Grep', 'Glob'];

/** Parse trajectory JSON text (or accept an already-parsed object). Never throws on bad JSON —
 *  returns {trajectory:null, errors:[...]} so the caller decides. */
export function loadTrajectory(input) {
  let obj = input;
  if (typeof input === 'string') {
    try {
      obj = JSON.parse(input);
    } catch (err) {
      return { trajectory: null, errors: [`invalid JSON: ${err.message}`] };
    }
  }
  const errors = validateTrajectory(obj);
  return { trajectory: errors.length ? null : obj, errors };
}

/** Structural check (hand-rolled, zero-dep). Returns a list of problems; empty = valid.
 *  Mirrors trajectory.schema.json but without pulling an npm validator into this zero-dep tree. */
export function validateTrajectory(t) {
  const errors = [];
  if (!t || typeof t !== 'object' || Array.isArray(t)) return ['trajectory must be an object'];
  if (t.schema !== SCHEMA_ID) errors.push(`schema must be "${SCHEMA_ID}"`);
  if (typeof t.trace_id !== 'string' || !t.trace_id.trim()) errors.push('trace_id is required');
  const p = t.provenance;
  if (!p || typeof p !== 'object' || Array.isArray(p)) {
    errors.push('provenance is required');
  } else {
    if (typeof p.model !== 'string' || !p.model.trim()) errors.push('provenance.model is required');
    if (typeof p.task_fingerprint !== 'string' || !p.task_fingerprint.trim())
      errors.push('provenance.task_fingerprint is required');
    if (!('prompt_version' in p))
      errors.push(
        'provenance.prompt_version key is required (may be null until a prompt-fingerprint source exists)',
      );
  }
  if (!Array.isArray(t.spans)) {
    errors.push('spans must be an array');
  } else {
    t.spans.forEach((s, i) => {
      if (!s || typeof s !== 'object') {
        errors.push(`spans[${i}] must be an object`);
        return;
      }
      if (typeof s.span_id !== 'string' || !s.span_id.trim())
        errors.push(`spans[${i}].span_id is required`);
      if (typeof s.operation !== 'string' || !s.operation.trim())
        errors.push(`spans[${i}].operation is required`);
    });
  }
  return errors;
}

/** True iff this trajectory carries a baseline's annotations/thresholds (a golden trace). */
export function isBaseline(t) {
  return !!(t && (t.annotations || t.thresholds));
}

// ── extractors: everything the deterministic scorer needs, read once from the spans ──

function byStart(a, b) {
  return String(a.start_ts || '').localeCompare(String(b.start_ts || ''));
}

/** execute_tool spans in wall-clock order → their tool names (the tool-path). */
export function toolPath(t, spans = t.spans) {
  return spans
    .filter((s) => s.operation === 'execute_tool')
    .slice()
    .sort(byStart)
    .map((s) => s.tool_name || stripOp(s.name) || '?');
}

function stripOp(name) {
  if (typeof name !== 'string') return null;
  const m = name.match(/^execute_tool\s+(.+)$/);
  return m ? m[1] : null;
}

/** Mutation spans each need a verifying span that starts after them → {mutations, verified}. */
export function mutationVerification(t, mutating = MUTATING_TOOLS, verifying = VERIFYING_TOOLS) {
  const tools = t.spans
    .filter((s) => s.operation === 'execute_tool')
    .slice()
    .sort(byStart);
  const mut = new Set(mutating);
  const ver = new Set(verifying);
  const mutations = tools.filter((s) => mut.has(s.tool_name || stripOp(s.name)));
  let verified = 0;
  for (const m of mutations) {
    const after = tools.some((s) => ver.has(s.tool_name || stripOp(s.name)) && byStart(s, m) > 0);
    if (after) verified++;
  }
  return { mutations: mutations.length, verified };
}

/** The instance's operator-ask tool vocabulary, declared on the baseline (annotations.tool_classes.
 *  operator_ask). There is NO universal default: a chat ending a turn is a turn boundary, not an
 *  ask, so question-economy can only be counted once the reference run names which tool calls are
 *  operator asks. Absent ⇒ null ⇒ the dimension is ungateable (the caller reports it, never passes
 *  it vacuously). */
export function askToolsOf(baseline) {
  return baseline?.annotations?.tool_classes?.operator_ask ?? null;
}

/** The instance's plan-approval tool vocabulary (annotations.tool_classes.plan_approval). A plan
 *  approval pauses to the user but is a separate class that never spends the question-economy
 *  budget; counted only for visibility. */
export function planApprovalToolsOf(baseline) {
  return baseline?.annotations?.tool_classes?.plan_approval ?? null;
}

/** Count operator-ask spans: execute_tool spans whose tool is in the baseline-declared ask set.
 *  Returns {count, gateable}. gateable is false when no ask vocabulary is declared — the caller must
 *  then report ask-vocabulary-required rather than a vacuous pass. The ask identity is the span's
 *  own tool_name, so a candidate cannot suppress its count without actually not-asking. */
export function operatorAsks(t, askTools) {
  if (!Array.isArray(askTools) || askTools.length === 0) return { count: 0, gateable: false };
  const ask = new Set(askTools);
  const count = t.spans.filter(
    (s) => s.operation === 'execute_tool' && ask.has(s.tool_name || stripOp(s.name)),
  ).length;
  return { count, gateable: true };
}

/** Count plan-approval spans (informational only): execute_tool spans in the plan_approval class.
 *  Never gates question-economy — it exists so the exclusion is visible in the scoreboard. */
export function planApprovals(t, planTools) {
  if (!Array.isArray(planTools) || planTools.length === 0) return 0;
  const plan = new Set(planTools);
  return t.spans.filter(
    (s) => s.operation === 'execute_tool' && plan.has(s.tool_name || stripOp(s.name)),
  ).length;
}

/** Fan-out structure: how many sub-agents were invoked and how many returned an outcome. */
export function fanOut(t) {
  const agents = t.spans.filter((s) => s.operation === 'invoke_agent');
  const ids = new Set(agents.map((s) => s.span_id));
  // A dispatched sub-agent = an invoke_agent whose parent is another invoke_agent (not the trace root).
  const dispatched = agents.filter((s) => s.parent_span_id && ids.has(s.parent_span_id));
  const returned = agents.filter((s) => s.self_report != null && s.self_report !== '').length;
  return { width: dispatched.length, agents: agents.length, returned };
}

/** Aggregate efficiency signals (informational deltas, not gated). */
export function efficiency(t) {
  let tokens_in = 0,
    tokens_out = 0,
    duration_ms = 0;
  for (const s of t.spans) {
    if (typeof s.tokens_in === 'number') tokens_in += s.tokens_in;
    if (typeof s.tokens_out === 'number') tokens_out += s.tokens_out;
  }
  const root = t.spans.find(
    (s) => s.operation === 'invoke_agent' && (!s.parent_span_id || s.parent_span_id === t.trace_id),
  );
  if (root && typeof root.duration_ms === 'number') duration_ms = root.duration_ms;
  return { tokens_in, tokens_out, duration_ms, span_count: t.spans.length };
}
