// rules/exfiltration.mjs — remote code execution, reverse shells, credential exfiltration.

import { cmd, snippet, CREDENTIAL_PATH, NETWORK_SEND } from "./_shared.mjs";

export default [
  {
    id: "pipe-to-shell",
    title: "Remote payload piped to a shell",
    severity: "blocking",
    category: "exfiltration",
    ref: "tool-gate.md#the-contract",
    check(surface) {
      const c = cmd(surface);
      // curl/wget ... | sh|bash|python  — fetch-and-execute, the supply-chain RCE shape.
      const re = /\b(curl|wget|fetch)\b[^\n|]*\|\s*(sudo\s+)?(sh|bash|zsh|python\d?|perl|ruby|node)\b/i;
      const hit = snippet(c, re);
      return hit ? [{ evidence: `${hit} — fetch-and-execute runs unreviewed remote code` }] : [];
    },
  },
  {
    id: "reverse-shell",
    title: "Reverse / bind shell",
    severity: "blocking",
    category: "exfiltration",
    ref: "tool-gate.md#the-contract",
    check(surface) {
      const c = cmd(surface);
      const re =
        /\b(bash|sh|zsh)\b\s+-i\b[^\n]*>\s*&?\s*\/dev\/tcp\/|\bnc\b[^\n]*\s-e\b|\bncat\b[^\n]*--exec|mkfifo[^\n]*\|\s*(sh|bash)\b[^\n]*\bnc\b|\/dev\/tcp\/[^\s/]+\/\d+/i;
      const hit = snippet(c, re);
      return hit ? [{ evidence: `${hit} — opens an interactive shell to a remote host` }] : [];
    },
  },
  {
    id: "credential-network-exfil",
    title: "Credential read piped to the network",
    severity: "blocking",
    category: "exfiltration",
    ref: "tool-gate.md#the-contract",
    check(surface) {
      const c = cmd(surface);
      // A sensitive credential path AND a network-send primitive in the same command.
      if (CREDENTIAL_PATH.test(c) && NETWORK_SEND.test(c)) {
        const hit = snippet(c, CREDENTIAL_PATH) || "credential";
        return [{ evidence: `${hit} sent over the network — credential exfiltration` }];
      }
      return [];
    },
  },
];
