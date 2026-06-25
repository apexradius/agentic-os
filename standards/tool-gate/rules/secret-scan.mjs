// rules/secret-scan.mjs — hardcoded credentials in a command or in written file content.
// (Named secret-scan, not secrets.*, so the repo gitignore secrets-guard doesn't eat the file.)
// Patterns mirror the shared gitleaks policy (framework/standards/ci/configs/gitleaks.toml):
// secrets belong in the environment or a secret manager, never in a tool call.

import { allText, snippet } from "./_shared.mjs";

const SECRET_PATTERNS = [
  { name: "private key block", re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/ },
  { name: "AWS access key id", re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: "GitHub token", re: /\bgh[posru]_[A-Za-z0-9]{36,}\b/ },
  { name: "Slack token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: "Stripe live key", re: /\bsk_live_[A-Za-z0-9]{16,}\b/ },
  { name: "Google API key", re: /\bAIza[0-9A-Za-z_\-]{35}\b/ },
  { name: "generic bearer/JWT", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
];

export default [
  {
    id: "hardcoded-secret",
    title: "Hardcoded credential in a tool input",
    severity: "blocking",
    category: "secrets",
    ref: "tool-gate.md#the-contract",
    check(surface) {
      const text = allText(surface);
      const findings = [];
      for (const { name, re } of SECRET_PATTERNS) {
        const hit = snippet(text, re, 24);
        if (hit) findings.push({ evidence: `${name} (${hit}…) — secrets belong in the environment or a secret manager, not a tool call` });
      }
      return findings;
    },
  },
];
