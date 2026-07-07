// cost.mjs — the cost-budget derivation, shared by validate.mjs (proof) and the instance
// $-report (apex/scripts/telemetry-cost.mjs). Zero deps (node: builtins only). Zone-pure:
// no prices live here — the price map is instance config, passed in.
//
// Two pure functions:
//   meterTranscript(text)  full-parse reference meter: dedup assistant messages by message.id
//                          (last-wins), sum the per-category usage per model. This is the
//                          reference the Python hook's incremental meter is proven against at a
//                          fixture boundary, and the honest per-session roll-up for the report.
//   costUsd(byModel, map)  per-category, per-model $ estimate at published list prices. cache_read
//                          is billed at ~10% of input, so a single-bucket $ would be an
//                          order-of-magnitude lie — this splits the four categories.

export const CATS = ["input", "cache_read", "cache_creation", "output"];

const USAGE_KEYS = {
  input: "input_tokens",
  cache_read: "cache_read_input_tokens",
  cache_creation: "cache_creation_input_tokens",
  output: "output_tokens",
};

function blankCats() {
  return { input: 0, cache_read: 0, cache_creation: 0, output: 0 };
}

// Fold a JSONL transcript into per-model category totals, deduped by message.id (last-wins).
// Mirrors the span emitter's dedup key and the Python guard's meter. Malformed lines are skipped.
export function meterTranscript(text) {
  const byId = new Map(); // message.id -> { model, cats }
  const order = [];
  for (const rawLine of String(text || "").split("\n")) {
    const s = rawLine.trim();
    if (!s) continue;
    let e;
    try { e = JSON.parse(s); } catch { continue; }
    if (!e || typeof e !== "object") continue;
    const msg = e.message;
    if (!msg || typeof msg !== "object" || msg.role !== "assistant") continue;
    const usage = msg.usage;
    if (!usage || typeof usage !== "object") continue;
    const cats = {};
    let any = false;
    for (const [cat, key] of Object.entries(USAGE_KEYS)) {
      const v = Number.isInteger(usage[key]) ? usage[key] : 0;
      cats[cat] = v;
      if (v) any = true;
    }
    if (!any) continue;
    const id = msg.id || e.uuid;
    if (!id) continue;
    if (!byId.has(id)) order.push(id);
    byId.set(id, { model: msg.model || null, cats }); // last-wins
  }
  const byModel = {};
  for (const id of order) {
    const { model, cats } = byId.get(id);
    const key = model || "unknown";
    if (!byModel[key]) byModel[key] = blankCats();
    for (const c of CATS) byModel[key][c] += cats[c];
  }
  return byModel;
}

export function totalTokens(byModel) {
  let t = 0;
  for (const v of Object.values(byModel || {})) for (const c of CATS) t += v[c] || 0;
  return t;
}

// Per-category, per-model $ estimate. rates are $ per 1,000,000 tokens; price map is
// { model: { input, cache_read, cache_creation, output }, default?: {...} }. Returns null when
// no rate matches (never a fabricated number).
export function costUsd(byModel, priceMap) {
  if (!byModel || !priceMap || typeof priceMap !== "object") return null;
  let total = 0;
  let matched = false;
  for (const [model, cats] of Object.entries(byModel)) {
    const rates = priceMap[model] || priceMap.default;
    if (!rates || typeof rates !== "object") continue;
    matched = true;
    for (const c of CATS) {
      total += ((cats[c] || 0) / 1_000_000) * (Number(rates[c]) || 0);
    }
  }
  return matched ? Math.round(total * 1e4) / 1e4 : null;
}
