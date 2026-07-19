// detect.mjs — the content-injection REFERENCE DETECTOR (the portable floor).
//
// A deterministic, zero-dependency Node port of the L1 (hidden-character) + L2 (heuristic) layers
// of a prompt-injection scanner, scoped to UNTRUSTED TOOL-RESULT content (a fetched web page, an
// email body, an MCP tool's output) before an agent acts on it. It is the executable SPEC the
// standard tests the corpus against, and the FLOOR an instance's hardened detector must meet or
// beat — the validator proves that parity. It never runs at runtime; the live scanner is the
// instance's own detector (see the instance manifest). Adopting the deterministic algorithm here
// (not an npm classifier) keeps `validate.mjs --all` self-proving on a bare `node` clone.
//
// Verdicts mirror a conservative input-side policy: favour FLAG over BLOCK so benign content is
// never dropped; the runtime action on a result is ADVISORY regardless of verdict (it annotates
// the content as untrusted, it does not deny the tool) — so a false FLAG is a noisy note, never
// lost data. Zone-pure: no hostnames, paths, or instance names live here.

export const ALLOW = 'allow';
export const FLAG = 'flag';
export const BLOCK = 'block';

// ── L1: hidden / invisible character smuggling ─────────────────────────────────────
// Invisible code points abused to hide instructions inside otherwise-benign text.
const ZERO_WIDTH = new Set([
  '​', // zero width space
  '‌', // zero width non-joiner
  '‍', // zero width joiner
  '⁠', // word joiner
  '﻿', // zero width no-break space / BOM
  '­', // soft hyphen
  '᠎', // mongolian vowel separator
]);
// Bidi controls (can visually reorder text to hide payloads).
const BIDI = new Set(['‪', '‫', '‬', '‭', '‮', '‎', '‏', '⁦', '⁧', '⁨', '⁩']);

// Unicode 'Tags' block U+E0000-U+E007F — used to smuggle invisible ASCII.
function isTagChar(cp) {
  return cp >= 0xe0000 && cp <= 0xe007f;
}

/** Remove invisible smuggling characters; decode tag-smuggled ASCII so L2 can inspect it.
 *  Returns { clean, removed:{zero_width,bidi,tag}, smuggledAscii, removedTotal, hadHidden }. */
export function stripHidden(text) {
  const src = String(text ?? '');
  const out = [];
  const removed = { zero_width: 0, bidi: 0, tag: 0 };
  const decodedTag = [];
  // Iterate by code point (tag chars are astral / surrogate pairs).
  for (const ch of src) {
    const cp = ch.codePointAt(0);
    if (ZERO_WIDTH.has(ch)) {
      removed.zero_width += 1;
      continue;
    }
    if (BIDI.has(ch)) {
      removed.bidi += 1;
      continue;
    }
    if (isTagChar(cp)) {
      removed.tag += 1;
      const ascii = cp - 0xe0000;
      if (ascii >= 0x20 && ascii <= 0x7e) decodedTag.push(String.fromCharCode(ascii));
      continue;
    }
    out.push(ch);
  }
  const removedTotal = removed.zero_width + removed.bidi + removed.tag;
  return {
    clean: out.join(''),
    removed,
    smuggledAscii: decodedTag.join(''),
    removedTotal,
    hadHidden: removedTotal > 0,
  };
}

// ── L2: deterministic heuristic classifier ─────────────────────────────────────────
// (pattern, weight, label, category). Weights sum then clamp to 1.0. Categories are the four
// the standard's corpus enumerates; every rule belongs to exactly one.
const HEURISTICS = [
  [
    /\bignore\s+(all\s+|any\s+)?(the\s+)?(previous|prior|above|earlier|preceding)\s+(instructions?|prompts?|messages?|context|rules?)/i,
    0.9,
    'ignore_previous',
    'instruction-override',
  ],
  [
    /\bdisregard\s+(all\s+|any\s+|the\s+)?(previous|prior|above|earlier|preceding|system)/i,
    0.9,
    'disregard',
    'instruction-override',
  ],
  [/\bforget\s+(everything|all|your|the\s+previous)/i, 0.7, 'forget', 'instruction-override'],
  [/\byou\s+are\s+now\s+(a|an|in|the)\b/i, 0.6, 'role_reassign', 'instruction-override'],
  [
    /\bnew\s+(system\s+)?(instructions?|prompt|rules?|directives?)\b/i,
    0.6,
    'new_instructions',
    'instruction-override',
  ],
  [
    /\boverride\s+(your\s+|the\s+|all\s+)?(instructions?|guidelines?|safety|restrictions?|rules?)/i,
    0.8,
    'override',
    'instruction-override',
  ],
  [
    /\bwithout\s+(telling|informing|notifying|alerting)\s+(the\s+)?(user|owner|operator)/i,
    0.75,
    'covert',
    'instruction-override',
  ],
  [
    /\b(reveal|print|repeat|output|show|display|tell\s+me)\s+(me\s+)?(your\s+|the\s+)?(system\s+prompt|initial\s+instructions?|the\s+rules?|your\s+instructions?|your\s+prompt)/i,
    0.85,
    'exfil_prompt',
    'exfil-request',
  ],
  [
    /\b(reveal|print|output|leak|send|exfiltrate|email|upload|post)\b.{0,40}\b(api[_\s-]?key|secret|token|password|credential|canary)/i,
    0.85,
    'exfil_secret',
    'exfil-request',
  ],
  [
    /<\s*\/?\s*(system|assistant|tool_call|function_call)\s*>|<\|.*?\|>|```tool_call/i,
    0.7,
    'role_smuggle',
    'tool-invocation-lure',
  ],
  [/\bact\s+as\s+(if\s+you\s+are\s+|a\s+|an\s+)/i, 0.4, 'act_as', 'tool-invocation-lure'],
  [/\[\s*(system|admin|root|instructions?)\s*\]/i, 0.5, 'bracket_role', 'tool-invocation-lure'],
  [/\bend\s+of\s+(prompt|instructions?|context)\b/i, 0.5, 'fake_boundary', 'tool-invocation-lure'],
  [/\b(developer|dan|jailbreak|god)\s+mode\b/i, 0.7, 'mode_jailbreak', 'tool-invocation-lure'],
];
const B64_BLOB = /[A-Za-z0-9+/]{80,}={0,2}/;

/** Deterministic 0..1 score with matched-rule labels, categories, and the offending excerpt.
 *  The excerpt is the transparency-relay payload: a consumer surfaces WHAT was injected, verbatim
 *  and as data, rather than silently swallowing it. */
export function heuristicScore(text) {
  const src = String(text ?? '');
  let score = 0;
  const labels = [];
  const categories = new Set();
  let excerpt = null;
  for (const [re, weight, label, category] of HEURISTICS) {
    const m = re.exec(src);
    if (m) {
      score += weight;
      labels.push(label);
      categories.add(category);
      if (excerpt === null) {
        const s = Math.max(0, m.index - 50);
        const e = Math.min(src.length, m.index + m[0].length + 50);
        excerpt =
          (s > 0 ? '…' : '') + src.slice(s, e).split(/\s+/).join(' ') + (e < src.length ? '…' : '');
      }
    }
  }
  if (B64_BLOB.test(src)) {
    score += 0.25;
    labels.push('base64_blob');
    categories.add('tool-invocation-lure');
  }
  return { score: Math.min(score, 1), labels, categories: [...categories], excerpt };
}

// ── facade: combine L1 + L2 into one verdict (mirrors the runtime detector's no-model path) ──
/** Classify untrusted inbound text (a tool result). Deterministic; never throws. Returns
 *  { verdict, confidence, categories, labels, reasons, excerpt, smuggledAscii }. */
export function scanInput(text) {
  const hidden = stripHidden(text);
  const scanTarget = hidden.clean + (hidden.smuggledAscii ? '\n' + hidden.smuggledAscii : '');
  const heur = heuristicScore(scanTarget);

  let blockVotes = 0;
  const reasons = [];
  const categories = new Set(heur.categories);
  if (heur.score >= 0.85) {
    blockVotes += 1;
    reasons.push(`heuristic:${heur.labels.join(',')}`);
  }
  if (hidden.hadHidden && hidden.smuggledAscii) {
    blockVotes += 1;
    reasons.push('hidden_smuggled_ascii');
  }
  // Hidden smuggling with no decoded instruction is still a canary-probe signal.
  if (hidden.hadHidden && hidden.removedTotal >= 3) categories.add('canary-probe');
  if (hidden.hadHidden && hidden.smuggledAscii) categories.add('canary-probe');

  let verdict;
  let confidence;
  if (blockVotes >= 2 || heur.score >= 0.9) {
    verdict = BLOCK;
    confidence = Math.min(0.6 + 0.2 * blockVotes, 1);
  } else if (heur.score >= 0.5 || (hidden.hadHidden && hidden.removedTotal >= 3)) {
    verdict = FLAG;
    confidence = Math.max(heur.score, 0.5);
  } else {
    verdict = ALLOW;
    confidence = 1 - heur.score;
  }

  return {
    verdict,
    confidence: Math.round(confidence * 1000) / 1000,
    categories: [...categories],
    labels: heur.labels,
    reasons,
    excerpt: heur.excerpt,
    smuggledAscii: hidden.smuggledAscii,
  };
}
