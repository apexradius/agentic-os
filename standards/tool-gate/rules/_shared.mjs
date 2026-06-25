// rules/_shared.mjs — helpers shared across tool-gate rule modules.

/** The executable command on this surface (Bash), lowercased copy for matching when asked. */
export function cmd(surface) {
  return surface.command || "";
}

/** Everything a payload could hide in: command + written content + path. */
export function allText(surface) {
  return surface.text || "";
}

/** First match of `re` against `str`, returned as a short evidence snippet (trimmed, capped). */
export function snippet(str, re, cap = 80) {
  const m = str.match(re);
  if (!m) return null;
  const s = (m[0] || "").replace(/\s+/g, " ").trim();
  return s.length > cap ? `${s.slice(0, cap)}…` : s;
}

/** Does the command read a sensitive credential path? (used by the exfil rule) */
export const CREDENTIAL_PATH =
  /(~|\$HOME|\/(home|root|Users)\/[^/\s]+)?\/?\.(ssh\/(id_[a-z0-9]+|authorized_keys)|aws\/credentials|netrc|kube\/config|docker\/config\.json)\b|\.env(\.[\w.-]+)?\b|\bid_rsa\b|\bid_ed25519\b/i;

/** A network-send primitive (curl/wget POST, nc, scp, a /dev/tcp redirect). */
export const NETWORK_SEND =
  /\b(curl|wget|nc|ncat|netcat|scp|sftp|rsync|ftp)\b|\/dev\/(tcp|udp)\//i;

/** Allowlist of known read-only, side-effect-free command heads (the gate's "allow" floor).
 *  `env` is deliberately absent: `env VAR=x <cmd>` runs an arbitrary subcommand, so it is not a
 *  read-only head. */
const SAFE_HEADS = [
  "ls", "pwd", "cat", "head", "tail", "wc", "stat", "file", "tree", "du", "df",
  "echo", "printf", "date", "whoami", "hostname", "uname", "which", "type",
  "grep", "rg", "fgrep", "egrep", "find", "fd", "sort", "uniq", "cut", "awk", "sed",
  "diff", "cmp", "basename", "dirname", "realpath", "readlink",
];
const SAFE_GIT = /^git\s+(status|diff|log|show|branch|remote|rev-parse|describe|blame|ls-files)\b/;

/** Heads that are read-only ONLY in their plain form. These flags/constructs turn a normally
 *  side-effect-free tool into a file mutator or arbitrary-command runner, so a segment carrying
 *  one is NOT pre-cleared — it falls through to "ask". */
const CONDITIONAL_UNSAFE = {
  find: /\s-(delete|exec|execdir|ok|okdir|fprint|fprintf|fls)\b/i, // -delete mutates; -exec runs commands
  sed: /(^|\s)(-i|--in-place)\b/i,                                  // in-place edit rewrites the file
  awk: /\bsystem\s*\(/i,                                            // system() shells out (no `>` to catch)
};

/**
 * Is this whole command a known-safe, read-only operation? Conservative: every segment split
 * on a pipe/&&/; must be allowlisted, and no segment may redirect to a file (`>`), so a safe
 * head can't be abused (`cat secrets > /dev/tcp/...`). A normally-safe head in a mutating form
 * (`find … -delete`, `sed -i`, `awk 'system(…)'`) is rejected too. Returns true only when certain.
 */
export function isAllowlisted(surface) {
  if ((surface.tool || "").toLowerCase() !== "bash") return false;
  const c = (surface.command || "").trim();
  if (!c) return false;
  if (/[>][>]?\s*\/?\S/.test(c)) return false; // any write redirect → not pre-cleared
  if (/\/dev\/(tcp|udp)\//.test(c)) return false;
  const segments = c.split(/\||&&|;|\n/).map((s) => s.trim()).filter(Boolean);
  return segments.every((seg) => {
    if (SAFE_GIT.test(seg)) return true;
    const head = seg.split(/\s+/)[0]?.replace(/^sudo\s+/, "");
    if (!SAFE_HEADS.includes(head)) return false;
    const unsafeForm = CONDITIONAL_UNSAFE[head];
    if (unsafeForm && unsafeForm.test(seg)) return false; // mutating form of a normally-safe head
    return true;
  });
}
