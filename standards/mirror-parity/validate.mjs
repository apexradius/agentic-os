#!/usr/bin/env node
// validate.mjs — the mirror-parity selftest, run bare by the framework harness
// (`validate.mjs --all`). Two proofs:
//   1. MECHANISM — RED/GREEN fixtures over headingOutline + compareOutlines: a
//      mirrored pair yields zero findings; every way a mirror can drift (added
//      section, renamed heading, reorder, level change, half-mirror, fenced-code
//      false heading) yields exactly the divergence it should.
//   2. INTEGRATION — discover the project root and check its real mirror pairs
//      (default CLAUDE.md ⇄ AGENTS.md, plus any declared in .mirror-parity.json).
//      Absent on a fresh framework-only clone → N/A, so the selftest still passes.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { headingOutline, compareOutlines, checkPairs, renderPair } from "./gate.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const checks = [];
const ok = (name, cond, detail = "") => { checks.push({ name, pass: !!cond, detail }); return !!cond; };

// ── 1. mechanism ─────────────────────────────────────────────────────────────

const BASE = ["# CLAUDE.md — title", "## Alpha", "body", "## Beta", "more", "### Beta.1", "end"].join("\n");
const MIRROR = ["# AGENTS.md — title", "## Alpha", "other", "## Beta", "x", "### Beta.1", "y"].join("\n");

const diff = (a, b, min = 2) => compareOutlines(headingOutline(a, min), headingOutline(b, min));

// GREEN: same outline, different title + bodies → zero findings.
ok("GREEN: mirrored pair has zero divergences", diff(BASE, MIRROR).length === 0,
  JSON.stringify(diff(BASE, MIRROR)));

// H1 excluded at minLevel 2 (titles legitimately differ); included at minLevel 1.
ok("minLevel 2 excludes the H1 title", headingOutline(BASE, 2).every((h) => h.level >= 2));
ok("minLevel 1 catches the differing H1", diff(BASE, MIRROR, 1).some((f) => f.kind === "mismatch"));

// RED: a section added to B only.
const ADDED = MIRROR.replace("### Beta.1\ny", "### Beta.1\ny\n## Gamma\nz");
ok("RED: added section flagged only-in-b", diff(BASE, ADDED).some((f) => f.kind === "only-in-b" && f.b === "## Gamma"));

// RED: a heading renamed in B.
const RENAMED = MIRROR.replace("## Beta", "## Bravo");
const rf = diff(BASE, RENAMED);
ok("RED: renamed heading flagged as mismatch", rf.some((f) => f.kind === "mismatch" && /## Beta\b/.test(f.a) && /## Bravo/.test(f.b)));

// RED: reordered sections.
const REORDER = ["# T", "## Beta", "## Alpha"].join("\n");
ok("RED: reorder produces mismatches", diff("# T\n## Alpha\n## Beta", REORDER).length === 2);

// RED: same text, different level.
ok("RED: level change is a mismatch", diff("## Alpha", "### Alpha").some((f) => f.kind === "mismatch"));

// RED: half-mirror — extra trailing heading on one side.
ok("RED: extra trailing heading flagged only-in-a", diff("## A\n## B", "## A").some((f) => f.kind === "only-in-a"));

// Fence guard: a `#` line inside a code fence is not a heading.
const FENCED = ["## Real", "```bash", "# not a heading", "## also not", "```", "## Also Real"].join("\n");
ok("fence guard: headings inside ``` are ignored",
  headingOutline(FENCED, 2).map((h) => h.text).join("|") === "Real|Also Real");

// Closed ATX headings (trailing #) normalize to the same text.
ok("closed ATX heading normalizes", diff("## Alpha", "## Alpha ##").length === 0);

// ── 2. integration ───────────────────────────────────────────────────────────

// Walk up from here to the project root: first ancestor with .git, or a manual.
function findRoot(start) {
  let dir = start;
  for (let i = 0; i < 12; i++) {
    if (existsSync(join(dir, ".git")) || existsSync(join(dir, "CLAUDE.md")) || existsSync(join(dir, "AGENTS.md"))) {
      return dir;
    }
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

const root = findRoot(__dirname);
if (!root) {
  ok("integration: no project root found — mechanism-only run", true);
} else {
  let pairs = [{ a: "CLAUDE.md", b: "AGENTS.md" }];
  let minLevel = 2;
  const cfgPath = join(root, ".mirror-parity.json");
  if (existsSync(cfgPath)) {
    const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
    if (Array.isArray(cfg.pairs) && cfg.pairs.length) pairs = cfg.pairs;
    if (typeof cfg.minLevel === "number") minLevel = cfg.minLevel;
  }
  const results = checkPairs(pairs, root, minLevel);
  for (const r of results) {
    ok(`integration: ${r.a} ⇄ ${r.b} mirrors (or N/A)`, r.status !== "fail",
      renderPair(r).slice(1).join(" | "));
  }
}

// ── report ───────────────────────────────────────────────────────────────────

const failed = checks.filter((c) => !c.pass);
for (const c of checks) {
  if (!c.pass) console.log(`  FAIL ${c.name}${c.detail ? `  [${c.detail}]` : ""}`);
}
console.log(`mirror-parity: ${checks.length - failed.length}/${checks.length} selftest checks passed`);
process.exit(failed.length ? 1 : 0);
