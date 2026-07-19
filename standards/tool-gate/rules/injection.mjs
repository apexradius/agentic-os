// rules/injection.mjs — heuristics (notes): obfuscated execution and injected instructions.
// These are fuzzy by nature, so they are NOTES — they ask a human, they don't deny outright.

import { allText, cmd, snippet } from './_shared.mjs';

export default [
  {
    id: 'obfuscated-exec',
    title: 'Obfuscated / decoded execution',
    severity: 'note',
    category: 'injection',
    ref: 'tool-gate.md#severity-decision',
    check(surface) {
      const c = cmd(surface);
      // base64 -d | sh,  echo <b64> | base64 --decode | bash,  eval "$(curl ...)"
      const re =
        /\bbase64\b[^\n|]*(-d|--decode|-D)\b[^\n]*\|\s*(sh|bash|zsh|python\d?)\b|\beval\b\s*["']?\$\(\s*(curl|wget|fetch)\b/i;
      const hit = snippet(c, re);
      return hit
        ? [{ evidence: `${hit} — decoded/obfuscated code is executed; review before running` }]
        : [];
    },
  },
  {
    id: 'injected-instructions',
    title: 'Prompt-injection markers in content',
    severity: 'note',
    category: 'injection',
    ref: 'tool-gate.md#severity-decision',
    check(surface) {
      const text = allText(surface);
      const re =
        /\b(ignore (all )?(the )?(previous|prior|above) (instructions|prompts?))\b|\bdisregard (the )?(system|previous) (prompt|instructions)\b|<!--\s*AI[: ][^>]*-->|\byou are now\b[^\n]*\b(dan|developer mode|jailbreak)\b/i;
      const hit = snippet(text, re);
      return hit
        ? [{ evidence: `${hit} — payload tries to redirect the agent; treat as untrusted` }]
        : [];
    },
  },
];
