#!/usr/bin/env node
// validate.mjs — the reference-integrity standard, run bare or by `validate.mjs --all`. Enforces
// doctrine/standards/reference-integrity.md: every internal markdown link in the framework's architectural
// docs resolves, and every doctrine standard + standards-as-code gate is listed in its index. A dead link
// in an extracted public tree is a broken promise; prose can't be trusted to stay honest about its own
// cross-references, so this proves it. The selftest runs on a temp tree (RED/GREEN); the scan validates the
// real surface. Primitive bodies (skills/, roles/) are out of scope — their own validators cover them, and
// their prose carries intentional placeholders/templates.

import { existsSync, readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", ".."); // framework/
const checks = [];
const ok = (name, cond, detail = "") => { checks.push({ name, pass: !!cond, detail }); return !!cond; };

// ── pure helpers ─────────────────────────────────────────────────────────────────
/** Drop fenced + inline code so link syntax shown as an *example* (e.g. a placeholder `](URL)`) isn't
 *  mistaken for a real link. Over-stripping is safe: real navigational links never live inside code. */
function stripCode(md) {
  return String(md ?? "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/~~~[\s\S]*?~~~/g, "")
    .replace(/`[^`\n]*`/g, "");
}
/** Relative link/image targets in markdown — external (http/mailto/tel), anchors, and code excluded. */
export function relativeLinkTargets(md) {
  const out = []; const re = /\]\(([^)]+)\)/g; let m;
  while ((m = re.exec(stripCode(md)))) {
    let t = m[1].trim();
    if (/^(https?:|mailto:|tel:|#)/.test(t)) continue;
    t = t.split("#")[0].split("?")[0];
    if (t) out.push(t);
  }
  return out;
}
/** Targets in `md` (located at `filePath`) that don't resolve to a real in-tree file/dir.
 *  A target that resolves OUTSIDE `root` is broken-on-extraction: it may resolve in a private
 *  superproject (`../../../CLAUDE.md` → the instance manual) yet 404 in the published tree where the
 *  framework IS the root. It is flagged regardless of local existence — the gate proves the *tree's
 *  own* links, and a link that escapes the tree is not one of them. (root optional: omitted ⇒ existence-only.) */
export function brokenLinksIn(filePath, md, root) {
  return relativeLinkTargets(md).filter((t) => {
    const abs = resolve(dirname(filePath), t);
    if (root && abs !== root && !abs.startsWith(root + sep)) return true;
    return !existsSync(abs);
  });
}
/** Names whose expected reference token `wrap(name)` is absent from the index text. */
export function unindexed(names, indexText, wrap) {
  return names.filter((n) => !String(indexText).includes(wrap(n)));
}

// ── selftest: link resolution + index parity, RED/GREEN on a temp tree ───────────
const dir = mkdtempSync(join(tmpdir(), "refint-selftest-"));
try {
  writeFileSync(join(dir, "exists.md"), "ok");
  const sample = "[a](exists.md) [b](missing.md) [x](https://e.com) [y](#anchor) [d](./)";
  ok("relativeLinkTargets: drops external + anchor-only", relativeLinkTargets(sample).join(",") === "exists.md,missing.md,./");
  ok("relativeLinkTargets: ignores link syntax inside inline code", relativeLinkTargets("[a](x.md) and `](URL)` here").join(",") === "x.md");
  ok("relativeLinkTargets: ignores link syntax inside a fenced block", relativeLinkTargets("[a](x.md)\n```\n[b](nope.md)\n```\n").join(",") === "x.md");
  const broken = brokenLinksIn(join(dir, "doc.md"), sample);
  ok("brokenLinksIn: flags the missing target only", broken.length === 1 && broken[0] === "missing.md", broken.join(","));
  ok("brokenLinksIn: a resolvable file is not flagged", !broken.includes("exists.md"));
  ok("brokenLinksIn: a directory link ('./') resolves", !broken.includes("./"));
  mkdirSync(join(dir, "sub"));
  const esc = brokenLinksIn(join(dir, "sub", "doc.md"), "[ok](../) [esc](../../)", dir);
  ok("brokenLinksIn: an in-root link passes the root check", !esc.includes("../"));
  ok("brokenLinksIn: a link escaping the root is flagged though its target exists on disk", esc.includes("../../"));
} finally { rmSync(dir, { recursive: true, force: true }); }
ok("unindexed: flags only the unlisted name", unindexed(["a.md", "b.md"], "see [a](a.md)", (n) => `(${n})`).join(",") === "b.md");

// ── scan: architectural-surface link integrity ──────────────────────────────────
const SKIP_DIR = new Set(["node_modules", ".git", "dist", "build", "coverage", ".next", "fixtures", "__fixtures__"]);
const SKIP_SUBTREE = ["skills", "roles"].map((s) => join(ROOT, s));
const SKIP_FILE = new Set(["TEMPLATE.md"]);
function walk(d, acc) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) { if (!SKIP_DIR.has(e.name)) walk(p, acc); }
    else if (e.name.endsWith(".md") && !SKIP_FILE.has(e.name)) acc.push(p);
  }
  return acc;
}
const surface = walk(ROOT, []).filter((f) => !SKIP_SUBTREE.some((s) => f.startsWith(s + "/")));
ok("scan: the architectural surface is non-empty", surface.length > 20, `files=${surface.length}`);

let brokenTotal = 0, firstBroken = "";
for (const f of surface) {
  const b = brokenLinksIn(f, readFileSync(f, "utf8"), ROOT);
  if (b.length) { brokenTotal += b.length; if (!firstBroken) firstBroken = `${f.slice(ROOT.length + 1)} -> ${b[0]}`; }
}
ok("scan: every internal link in the architectural docs resolves", brokenTotal === 0, `${brokenTotal} broken; first: ${firstBroken}`);

// ── parity: every standard is on its map (the link scan proves the reverse) ──────
const docStdDir = join(ROOT, "doctrine", "standards");
const docStandards = readdirSync(docStdDir).filter((n) => n.endsWith(".md") && n !== "README.md");
const docMissing = unindexed(docStandards, readFileSync(join(docStdDir, "README.md"), "utf8"), (n) => `(${n})`);
ok("parity: every doctrine standard is listed in doctrine/standards/README.md", docMissing.length === 0, docMissing.join(", "));

const ruleDir = join(ROOT, "doctrine", "rules");
const rules = readdirSync(ruleDir).filter((n) => n.endsWith(".md") && n !== "README.md");
const ruleMissing = unindexed(rules, readFileSync(join(ruleDir, "README.md"), "utf8"), (n) => `(${n})`);
ok("parity: every doctrine rule is listed in doctrine/rules/README.md", ruleMissing.length === 0, ruleMissing.join(", "));

const stdDir = join(ROOT, "standards");
const codeStandards = readdirSync(stdDir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join(stdDir, e.name, "validate.mjs")))
  .map((e) => e.name);
const stdMissing = unindexed(codeStandards, readFileSync(join(stdDir, "README.md"), "utf8"), (n) => `(${n}/)`);
ok("parity: every standards-as-code gate is listed in standards/README.md", stdMissing.length === 0, stdMissing.join(", "));

for (const f of ["validate.mjs", "README.md"]) ok(`file present: ${f}`, existsSync(join(__dirname, f)));

const failed = checks.filter((c) => !c.pass);
for (const c of checks) if (!c.pass) console.log(`  FAIL ${c.name}${c.detail ? `  [${c.detail}]` : ""}`);
console.log(`reference-integrity: ${checks.length - failed.length}/${checks.length} selftest checks passed`);
process.exit(failed.length ? 1 : 0);
