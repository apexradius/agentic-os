// collect.mjs — extract the untrusted text from a tool result.
//
// The runtime hook receives a PostToolUse payload and must gather every string in the arbitrary
// `tool_response` shape (a bare string, a rich object, an array of content blocks) before scanning.
// This mirrors that gather so the corpus fixtures are a faithful replay of what the hook sees, and
// so the floor and the instance detector are fed identical input. One implementation, shared by the
// discrimination and parity checks — no drift between "what we test" and "what we extract".

const BUDGET = 200_000;

/** Recursively gather string content from an arbitrary tool_response node into `out`. */
export function collectInto(node, out) {
  if (out.reduce((n, s) => n + s.length, 0) > BUDGET) return;
  if (typeof node === 'string') {
    out.push(node);
  } else if (Array.isArray(node)) {
    for (const v of node) collectInto(v, out);
  } else if (node && typeof node === 'object') {
    for (const v of Object.values(node)) collectInto(v, out);
  }
}

/** The joined untrusted text for a tool_response (the scan target). */
export function collectText(toolResponse) {
  const parts = [];
  collectInto(toolResponse, parts);
  return parts.join('\n');
}
