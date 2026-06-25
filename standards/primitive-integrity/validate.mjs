#!/usr/bin/env node
// validate.mjs — the primitive-integrity standard, run bare or by `validate.mjs --all`. Enforces
// doctrine/standards/primitive-integrity.md: every primitive definition under framework/primitives/
// (excluding the shared _lib/) carries all four mandated artifacts — spec.md, a *.schema.json,
// creator.md, validate.mjs. The harness discovers primitives BY the existence of their validator, so a
// primitive missing its validator (or schema, or creator) is silently SKIPPED, not failed — invisible in
// the `N primitives` count. This gate enumerates the folders directly and flags an incomplete one by
// name. The selftest runs on a temp tree (RED/GREEN); the scan validates the real primitives.

import { existsSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", ".."); // framework/
const checks = [];
const ok = (name, cond, detail = "") => { checks.push({ name, pass: !!cond, detail }); return !!cond; };

// ── pure helper ──────────────────────────────────────────────────────────────────
/** The four artifacts every primitive definition must ship. Each tests against a flat list of the
 *  directory's entry names. `*.schema.json` matches any file ending in `.schema.json`. */
const REQUIRED = [
  { key: "spec.md", test: (files) => files.includes("spec.md") },
  { key: "*.schema.json", test: (files) => files.some((f) => f.endsWith(".schema.json")) },
  { key: "creator.md", test: (files) => files.includes("creator.md") },
  { key: "validate.mjs", test: (files) => files.includes("validate.mjs") },
];
/** Names of the mandated artifacts absent from `files` (a directory's entry list). Empty ⇒ complete. */
export function missingArtifacts(files) {
  return REQUIRED.filter((r) => !r.test(files)).map((r) => r.key);
}

// ── selftest: completeness on a temp tree, RED/GREEN ─────────────────────────────
const dir = mkdtempSync(join(tmpdir(), "primint-selftest-"));
try {
  mkdirSync(join(dir, "good"));
  for (const f of ["spec.md", "good.schema.json", "creator.md", "validate.mjs"]) writeFileSync(join(dir, "good", f), "");
  ok("missingArtifacts: a complete primitive has none missing", missingArtifacts(readdirSync(join(dir, "good"))).length === 0);

  mkdirSync(join(dir, "bad"));
  for (const f of ["spec.md", "validate.mjs"]) writeFileSync(join(dir, "bad", f), ""); // no schema, no creator
  const bad = missingArtifacts(readdirSync(join(dir, "bad")));
  ok("missingArtifacts: flags an absent schema", bad.includes("*.schema.json"));
  ok("missingArtifacts: flags an absent creator", bad.includes("creator.md"));
  ok("missingArtifacts: does not flag present artifacts", !bad.includes("spec.md") && !bad.includes("validate.mjs"));
  ok("missingArtifacts: any-name schema satisfies the schema slot", missingArtifacts(["spec.md", "x.schema.json", "creator.md", "validate.mjs"]).length === 0);
} finally { rmSync(dir, { recursive: true, force: true }); }

// ── scan: every real primitive definition is complete ────────────────────────────
const primDir = join(ROOT, "primitives");
const primitives = readdirSync(primDir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name !== "_lib")
  .map((e) => e.name);
ok("scan: found the primitive definitions", primitives.length >= 6, `found ${primitives.length}`);

let firstBad = "";
const incomplete = primitives.filter((p) => {
  const m = missingArtifacts(readdirSync(join(primDir, p)));
  if (m.length && !firstBad) firstBad = `${p}: missing ${m.join(", ")}`;
  return m.length > 0;
});
ok("scan: every primitive carries spec + schema + creator + validator", incomplete.length === 0, firstBad);

for (const f of ["validate.mjs", "README.md"]) ok(`file present: ${f}`, existsSync(join(__dirname, f)));

const failed = checks.filter((c) => !c.pass);
for (const c of checks) if (!c.pass) console.log(`  FAIL ${c.name}${c.detail ? `  [${c.detail}]` : ""}`);
console.log(`primitive-integrity: ${checks.length - failed.length}/${checks.length} selftest checks passed`);
process.exit(failed.length ? 1 : 0);
