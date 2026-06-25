#!/usr/bin/env node
// validate.mjs — the threat-model standard selftest + scan, run bare or by `validate.mjs --all`. Enforces
// the FORMAT half of doctrine/standards/threat-model.md: every THREAT-MODEL.md the framework ships answers
// the four build-time questions (trust boundary, privilege, blast radius, mitigation) with a non-empty
// body. It does NOT judge whether the reasoning is right — that is the security-reviewer role. The selftest
// is inline (a complete model passes; dropping any one question fails, naming it); the scan validates the
// real artifacts on disk, skipping node_modules and other vendored trees.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", ".."); // framework/
const checks = [];
const ok = (name, cond, detail = "") => { checks.push({ name, pass: !!cond, detail }); return !!cond; };

// ── the four required questions, as heading matchers (space or hyphen, h2–h4) ────
const SECTIONS = [
  { key: "trust boundary", re: /^#{2,4}\s+trust[ -]?boundary\b/im, head: /^#{2,4}\s+trust\b/im },
  { key: "privilege",      re: /^#{2,4}\s+privilege\b/im,          head: /^#{2,4}\s+privilege\b/im },
  { key: "blast radius",   re: /^#{2,4}\s+blast[ -]?radius\b/im,    head: /^#{2,4}\s+blast\b/im },
  { key: "mitigation",     re: /^#{2,4}\s+mitigations?\b/im,        head: /^#{2,4}\s+mitigation/im },
];

/** Body under the first heading matching `re`: lines until the next ATX heading. null if no such heading. */
function bodyAfter(md, re) {
  const lines = String(md ?? "").split(/\r?\n/);
  const idx = lines.findIndex((l) => re.test(l));
  if (idx === -1) return null;
  const body = [];
  for (let i = idx + 1; i < lines.length; i++) {
    if (/^#{1,4}\s/.test(lines[i])) break;
    body.push(lines[i]);
  }
  return body.join("\n").trim();
}

/** Complete iff every required question is present with a non-empty body. Returns the missing keys. */
export function checkThreatModel(md) {
  const missing = [];
  for (const s of SECTIONS) {
    const body = bodyAfter(md, s.re);
    if (body === null || body.length === 0) missing.push(s.key);
  }
  return { complete: missing.length === 0, missing };
}

// ── selftest: a complete model passes; dropping any one question fails, naming it ─
const complete = [
  "# Threat model: example primitive",
  "## Trust boundary", "Reads attacker-controllable file content the agent was asked to edit.",
  "## Privilege", "Can write files and run a shell with the user's rights.",
  "## Blast radius", "A hostile payload could steer it to exfiltrate a secret or wipe a path.",
  "## Mitigation", "tool-gate denies the dangerous shape; data-handling redacts the secret; reviewer judges novel shapes.",
  "",
].join("\n");

ok("checkThreatModel: a complete model is complete", checkThreatModel(complete).complete);
for (const s of SECTIONS) {
  const broken = complete.replace(s.head, "## REMOVED");
  const r = checkThreatModel(broken);
  ok(`checkThreatModel: a missing "${s.key}" is detected`, !r.complete && r.missing.includes(s.key), JSON.stringify(r.missing));
}
ok("checkThreatModel: a heading with an empty body counts as missing",
  checkThreatModel("## Trust boundary\n## Privilege\nx\n## Blast radius\nx\n## Mitigation\nx").missing.includes("trust boundary"));
ok("checkThreatModel: the hyphen spelling 'Blast-radius' is accepted",
  checkThreatModel(complete.replace("Blast radius", "Blast-radius")).complete);

// ── scan: every THREAT-MODEL.md the framework ships answers all four ─────────────
const SKIP = new Set(["node_modules", ".git", "dist", "build", "coverage", ".next"]);
function walk(dir, acc) {
  let entries = [];
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(p, acc); }
    else if (e.name === "THREAT-MODEL.md") acc.push(p);
  }
  return acc;
}
const models = walk(ROOT, []);
ok("scan: at least one THREAT-MODEL.md ships (the exemplar)", models.length >= 1, `found ${models.length}`);

let firstBad = "";
const allComplete = models.every((m) => {
  const r = checkThreatModel(readFileSync(m, "utf8"));
  if (!r.complete && !firstBad) firstBad = `${m.slice(ROOT.length)}: missing ${r.missing.join(", ")}`;
  return r.complete;
});
ok("scan: every shipped THREAT-MODEL.md answers all four questions", allComplete, firstBad);

const exemplar = join(ROOT, "standards", "tool-gate", "THREAT-MODEL.md");
ok("scan: the tool-gate exemplar is present + complete",
  existsSync(exemplar) && checkThreatModel(readFileSync(exemplar, "utf8")).complete);

for (const f of ["validate.mjs", "README.md"]) ok(`file present: ${f}`, existsSync(join(__dirname, f)));

const failed = checks.filter((c) => !c.pass);
for (const c of checks) if (!c.pass) console.log(`  FAIL ${c.name}${c.detail ? `  [${c.detail}]` : ""}`);
console.log(`threat-model: ${checks.length - failed.length}/${checks.length} selftest checks passed`);
process.exit(failed.length ? 1 : 0);
