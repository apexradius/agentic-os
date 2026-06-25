// rules/destructive.mjs — irreversible filesystem / disk destruction.

import { cmd, snippet } from "./_shared.mjs";

export default [
  {
    id: "recursive-force-delete",
    title: "Recursive force-delete",
    severity: "blocking",
    category: "destructive",
    ref: "tool-gate.md#the-contract",
    check(surface) {
      const c = cmd(surface);
      // rm with both recursive and force, in any flag order (-rf, -fr, -r -f, --recursive --force).
      const re = /\brm\b[^\n|;&]*?(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r|--recursive\b[^\n|;&]*--force|--force\b[^\n|;&]*--recursive)/i;
      const hit = snippet(c, re);
      return hit ? [{ evidence: `${hit} — recursive force-delete is irreversible` }] : [];
    },
  },
  {
    id: "disk-overwrite",
    title: "Raw disk / device overwrite",
    severity: "blocking",
    category: "destructive",
    ref: "tool-gate.md#the-contract",
    check(surface) {
      const c = cmd(surface);
      const re = /\b(mkfs(\.\w+)?|wipefs|shred|fdisk)\b|\bdd\b[^\n]*\bof=\/dev\/|>\s*\/dev\/(sd|nvme|disk|hd)\w*/i;
      const hit = snippet(c, re);
      return hit ? [{ evidence: `${hit} — writes/erases a raw block device` }] : [];
    },
  },
  {
    id: "fork-bomb",
    title: "Fork bomb / resource exhaustion",
    severity: "blocking",
    category: "destructive",
    ref: "tool-gate.md#the-contract",
    check(surface) {
      const c = cmd(surface);
      // Classic :(){ :|:& };:  and named-function variants (the fn name may be `:`).
      const re = /([:\w]+)\s*\(\s*\)\s*\{\s*\1\s*\|\s*\1\s*&\s*\}\s*;\s*\1/;
      const hit = snippet(c, re);
      return hit ? [{ evidence: `${hit} — fork bomb` }] : [];
    },
  },
];
