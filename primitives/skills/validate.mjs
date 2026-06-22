#!/usr/bin/env node
// framework/primitives/skills/validate.mjs — validate SKILL.md files.
//
//   node validate.mjs                 validate in-repo skills (framework/skills + apex/skills) + selftest
//   node validate.mjs <SKILL.md> ...  validate specific skill files
//   node validate.mjs --selftest      prove the validator with inline good/bad fixtures
//
// A skill is one SKILL.md per directory: YAML frontmatter (skills.schema.json) + a markdown
// procedure body. The format is IDENTICAL across both runtimes (Claude and Codex read the
// same file), so there is no emit/projection — distribution is a pure copy handled by
// apex/config/codex-sync, not a per-primitive transform. Two honest layers:
//   1. FRONTMATTER -> ajv against skills.schema.json (OPEN schema; see spec.md)
//   2. BODY        -> code: non-empty; progressive-disclosure size guard (<500 lines)

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseFrontmatter } from "../_lib/frontmatter.mjs";
import { compileSchema, formatErrors } from "../_lib/schema.mjs";
import { loadCoupling, couplingMatch, GENERIC_COUPLING } from "../_lib/zone-coupling.mjs";

// Re-export the arbiter so external consumers (e.g. a migration classifier) keep importing it here.
export { couplingMatch };

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..", "..", "..");
const SOURCE_DIRS = [join(REPO, "framework", "skills"), join(REPO, "apex", "skills")];
const BODY_LINE_BUDGET = 500; // progressive-disclosure: SKILL.md stays small, refs load on demand

// ZONE guard. A framework/skills/ skill must carry ZERO Apex coupling — generic & portable.
// The ARBITER is couplingMatch() (imported + re-exported above from ../_lib/zone-coupling.mjs): the
// migration classifier routes a skill to framework/ iff couplingMatch() returns null over its SKILL.md
// + every reference file, else apex/. The guard runs on every validate, so a misrouted coupled skill
// in framework/ fails the build — the guard is the proof the classifier was right, not a parallel
// heuristic. The token list is externalized to apex/config/zone-coupling.json "skills" profile
// (CLEANUP C3) — framework/ ships only a generic default; mirrors the agents COUPLING guard.

// Text files worth scanning for coupling (skip binaries/images/runtime state like queue.json).
function isScannable(name) {
  return /\.(md|markdown|txt|ya?ml|json|toml|jsonc|js|mjs|cjs|ts|tsx|py|rb|sh|bash|zsh|html|css|env|example|conf|ini)$/i.test(name);
}

// Read every scannable text file in a skill dir, one level deep (references/, scripts/, assets/).
function readSiblingTexts(skillDir) {
  const texts = [];
  let entries;
  try { entries = readdirSync(skillDir); } catch { return texts; }
  for (const entry of entries) {
    if (entry === "SKILL.md") continue;
    const p = join(skillDir, entry);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) {
      let inner;
      try { inner = readdirSync(p); } catch { continue; }
      for (const f of inner) {
        const fp = join(p, f);
        try { if (statSync(fp).isFile() && isScannable(f)) texts.push(readFileSync(fp, "utf8")); } catch { /* skip */ }
      }
    } else if (st.isFile() && isScannable(entry)) {
      try { texts.push(readFileSync(p, "utf8")); } catch { /* skip */ }
    }
  }
  return texts;
}

// A framework/skills/ skill must be Apex-free in BOTH its body and its reference files.
// Resolve to absolute first so the gate fires identically for relative CLI args and the
// absolute paths collectTargets() builds — a relative `framework/skills/x/SKILL.md` must NOT
// slip past the guard.
function checkZone(path, raw, errors) {
  const abs = resolve(path);
  if (!abs.startsWith(`${join(REPO, "framework", "skills")}/`)) return;
  const hit = couplingMatch([raw, ...readSiblingTexts(dirname(abs))]);
  if (hit) {
    errors.push(`framework/skills must be Apex-free, but contains '${hit}' (SKILL.md or a reference file) — route to apex/skills`);
  }
}

const schema = JSON.parse(readFileSync(join(__dirname, "skills.schema.json"), "utf8"));
const validateFrontmatter = compileSchema(schema);

// Eval coverage (the failing-baseline standard). A skill SHOULD carry an `eval.md` next to
// SKILL.md — the "earns its context" proof in the superpowers/Anthropic-skills tradition.
// Policy is MEASURED, not blocking (honest + measured, 2026-06-22): a missing eval.md is a
// WARNING so coverage is visible and shrinkable on every run, never a build break. But a
// PRESENT eval.md must be a real eval, not a stub — a malformed one is an ERROR, because a
// broken eval is worse than an absent one (it reads as covered when it isn't).
//
// TWO eval shapes (eval-type in eval.md frontmatter; default 'baseline'):
//   • baseline (RED→GREEN) — the default for behavioral/discipline/output-shape skills. The
//     BASELINE (no skill) fails a discrete criterion; the skill makes it PASS. Sections:
//     '## Baseline' + '## Pass' (or '## With skill').
//   • rubric — for creative/generative skills where a binary pass is contrived. A scored set
//     of weighted, checkable criteria with a threshold. Sections: '## Rubric' + '## Pass
//     threshold'. Added 2026-06-22 so creative-skill evals stay real instead of forcing a
//     hollow RED→GREEN (which would be exactly the folklore this standard exists to kill).
//
//   evalRaw === undefined → no filesystem context (pure text-mode selftest) → skip the check
//   evalRaw === null      → eval.md absent → warning
//   evalRaw === string    → eval.md present → must conform to its declared eval-type shape
function checkEval(evalRaw, errors, warnings) {
  if (evalRaw === undefined) return;
  if (evalRaw === null) {
    warnings.push("no eval.md — add a failing-baseline eval (baseline RED→GREEN, or a rubric for creative skills)");
    return;
  }
  if (evalRaw.trim() === "") {
    errors.push("eval.md is empty — a present eval must define its sections (baseline: '## Baseline'+'## Pass'; rubric: '## Rubric'+'## Pass threshold')");
    return;
  }

  // Shape is declared by eval-type frontmatter; default 'baseline'. Missing/garbled
  // frontmatter is not fatal here — fall back to baseline and let the section checks speak.
  let evalType = "baseline";
  try {
    const { data } = parseFrontmatter(evalRaw);
    if (data && data["eval-type"]) evalType = String(data["eval-type"]).trim();
  } catch { /* treat as baseline */ }

  if (evalType === "rubric") {
    if (!/^##\s+rubric\b/im.test(evalRaw)) {
      errors.push("rubric eval.md missing a '## Rubric' section (the scored, weighted criteria)");
    }
    if (!/^##\s+(pass[ -]?threshold|threshold)\b/im.test(evalRaw)) {
      errors.push("rubric eval.md missing a '## Pass threshold' section (the score required to pass)");
    }
  } else if (evalType === "baseline") {
    if (!/^##\s+baseline\b/im.test(evalRaw)) {
      errors.push("eval.md missing a '## Baseline' section (the no-skill failure the eval pins down)");
    }
    if (!/^##\s+(pass|with skill)\b/im.test(evalRaw)) {
      errors.push("eval.md missing a '## Pass' (or '## With skill') section (the with-skill success criterion)");
    }
  } else {
    errors.push(`eval.md has unknown eval-type '${evalType}' (expected 'baseline' or 'rubric')`);
  }
}

// Core check on raw text — used by both file validation and the inline selftest.
// `dirName` is the skill's containing directory (for the name==dir convention check).
// `evalRaw` is the sibling eval.md contents (string), null if absent, or undefined to skip.
export function checkSkill(raw, dirName = null, evalRaw = undefined) {
  const errors = [];
  const warnings = [];

  let parsed;
  try {
    parsed = parseFrontmatter(raw);
  } catch (e) {
    return { errors: [`frontmatter: ${e.message}`], warnings };
  }
  const { data, body, hasFrontmatter } = parsed;

  if (!hasFrontmatter) errors.push("no frontmatter block");

  if (!validateFrontmatter(data)) {
    for (const line of formatErrors(validateFrontmatter.errors)) errors.push(`frontmatter ${line}`);
  }

  if (body.trim() === "") errors.push("empty body — a skill must contain a procedure");

  // Convention (warning, not error — the ecosystem is not uniform): name should match dir.
  if (dirName && data.name && data.name !== dirName) {
    warnings.push(`name '${data.name}' != directory '${dirName}'`);
  }

  // Progressive disclosure: keep SKILL.md small; push detail into one-level-deep references.
  const lineCount = body.split("\n").length;
  if (lineCount > BODY_LINE_BUDGET) {
    warnings.push(`body is ${lineCount} lines (> ${BODY_LINE_BUDGET}); move detail into references/`);
  }

  checkEval(evalRaw, errors, warnings); // measured eval coverage: warn if absent, error if malformed

  return { errors, warnings };
}

export function validateSkillFile(path) {
  // The skill name should equal its containing directory (…/<name>/SKILL.md).
  const dirName = basename(dirname(path));
  const raw = readFileSync(path, "utf8");
  // Sibling eval.md: contents if present, null if absent (drives the measured coverage warning).
  const evalPath = join(dirname(path), "eval.md");
  const evalRaw = existsSync(evalPath) ? readFileSync(evalPath, "utf8") : null;
  const { errors, warnings } = checkSkill(raw, dirName, evalRaw);
  checkZone(path, raw, errors); // framework/skills/ must be Apex-free (body + references)
  return { path, errors, warnings, hasEval: evalRaw !== null && errors.every((e) => !e.startsWith("eval.md")) };
}

// ── Selftest: prove the validator accepts a good skill and rejects bad ones ──────
function runSelftest() {
  const good = [
    "---",
    "name: deep-research",
    "description: Multi-step web research with source verification. Use when researching topics in depth or fact-checking.",
    "user-invocable: true",
    "context: fork",
    "argument-hint: [research-question]",
    "---",
    "## Procedure",
    "1. Decompose the question. 2. Search. 3. Verify sources. 4. Synthesize.",
    "",
  ].join("\n");

  const cases = [
    ["accepts a valid skill", good, null, (r) => r.errors.length === 0],
    [
      "accepts an unknown frontmatter key (open schema)",
      "---\nname: x\ndescription: does a thing; use when y\nbrand-new-key: 1\n---\nbody\n",
      null,
      (r) => r.errors.length === 0,
    ],
    [
      "rejects missing name",
      "---\ndescription: does a thing; use when y\n---\nbody\n",
      null,
      (r) => r.errors.some((e) => /name/.test(e)),
    ],
    [
      "rejects a non-kebab name",
      "---\nname: Deep_Research\ndescription: does a thing; use when y\n---\nbody\n",
      null,
      (r) => r.errors.some((e) => /name|pattern/.test(e)),
    ],
    [
      "rejects angle brackets in description",
      "---\nname: x\ndescription: emits <html> tags\n---\nbody\n",
      null,
      (r) => r.errors.some((e) => /description|pattern/.test(e)),
    ],
    [
      "rejects an empty body",
      "---\nname: x\ndescription: does a thing; use when y\n---\n\n",
      null,
      (r) => r.errors.some((e) => /empty body/.test(e)),
    ],
    [
      "warns when name != directory",
      "---\nname: alpha\ndescription: does a thing; use when y\n---\nbody\n",
      "beta",
      (r) => r.errors.length === 0 && r.warnings.some((w) => /!= directory/.test(w)),
    ],
    // ── eval coverage (measured, not blocking) ──
    [
      "warns when eval.md is absent",
      good,
      null,
      (r) => r.errors.length === 0 && r.warnings.some((w) => /no eval\.md/.test(w)),
      null, // evalRaw: absent
    ],
    [
      "accepts a well-formed eval.md",
      good,
      null,
      (r) => r.errors.length === 0 && !r.warnings.some((w) => /eval/.test(w)),
      "---\nskill: deep-research\n---\n## Baseline\nNo skill: agent skips source verification.\n## Pass\nWith skill: every claim cites a verified source.\n",
    ],
    [
      "rejects an eval.md missing a Baseline section",
      good,
      null,
      (r) => r.errors.some((e) => /Baseline/.test(e)),
      "## Pass\nWith skill: it works.\n",
    ],
    [
      "rejects an empty eval.md",
      good,
      null,
      (r) => r.errors.some((e) => /eval\.md is empty/.test(e)),
      "",
    ],
    // ── rubric eval shape (for creative/generative skills) ──
    [
      "accepts a well-formed rubric eval.md",
      good,
      null,
      (r) => r.errors.length === 0 && !r.warnings.some((w) => /eval/.test(w)),
      "---\nskill: ai-image\neval-type: rubric\n---\n## Task\nGenerate a product hero shot.\n## Rubric\n| # | Criterion | Weight |\n|---|---|---|\n| 1 | on-brief subject | 3 |\n## Pass threshold\n>= 8 of 10.\n",
    ],
    [
      "rejects a rubric eval missing the Rubric section",
      good,
      null,
      (r) => r.errors.some((e) => /'## Rubric'/.test(e)),
      "---\neval-type: rubric\n---\n## Task\nx\n## Pass threshold\n>= 8.\n",
    ],
    [
      "rejects an unknown eval-type",
      good,
      null,
      (r) => r.errors.some((e) => /unknown eval-type/.test(e)),
      "---\neval-type: vibes\n---\n## Whatever\nx\n",
    ],
  ];

  let pass = 0;
  for (const [name, raw, dir, ok, evalRaw] of cases) {
    const res = checkSkill(raw, dir, evalRaw);
    const good = ok(res);
    if (good) pass++;
    console.log(`  ${good ? "ok  " : "FAIL"} ${name}`);
  }

  // Zone guard: the coupling discriminator (the classifier's shared arbiter) must FIRE on coupling
  // tokens and PASS clean generic text. A reject-coupled fixture proves the guard isn't vacuous.
  // Generic fixtures (no real org tokens) tested against GENERIC_COUPLING.skills, so the selftest
  // proves the MECHANISM identically whether or not an adopter config (apex/config/zone-coupling.json)
  // is present — the live arbiter via couplingMatch() may use a richer adopter pattern.
  const zoneCases = [
    ["zone: flags a hardcoded host", "deploy to 198.51.100.7", (h) => h !== null],
    ["zone: flags an org-name reference", "post to the acme billing API", (h) => h !== null],
    ["zone: flags an mcp__ tool call", "call mcp__example-omnibus__qmd__query", (h) => h !== null],
    ["zone: flags a /home path", "read /home/example/config.yaml", (h) => h !== null],
    ["zone: flags an org reference", "sync the example-corp client roster", (h) => h !== null],
    ["zone: passes clean generic text", "a portable skill for running unit tests and reporting coverage", (h) => h === null],
  ];
  for (const [name, text, ok] of zoneCases) {
    const good = ok(couplingMatch([text], GENERIC_COUPLING.skills));
    if (good) pass++;
    console.log(`  ${good ? "ok  " : "FAIL"} ${name}`);
  }

  const total = cases.length + zoneCases.length;
  console.log(`\nskills selftest: ${pass}/${total} passed`);
  return pass === total;
}

// In-repo skills live as <dir>/SKILL.md; collect those.
function collectTargets(args) {
  const files = args.filter((a) => !a.startsWith("--"));
  if (files.length) return files;
  const out = [];
  for (const root of SOURCE_DIRS) {
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root)) {
      const skillMd = join(root, entry, "SKILL.md");
      if (existsSync(skillMd) && statSync(skillMd).isFile()) out.push(skillMd);
    }
  }
  return out.sort();
}

// ── CLI ──────────────────────────────────────────────────────────────────────
if (process.argv[1] && process.argv[1].endsWith("validate.mjs")) {
  const args = process.argv.slice(2);

  if (args.includes("--selftest")) {
    process.exit(runSelftest() ? 0 : 1);
  }

  const explicit = args.filter((a) => !a.startsWith("--")).length > 0;
  const targets = collectTargets(args);
  let failed = 0;
  let warned = 0;
  let withEval = 0;
  for (const t of targets) {
    const { errors, warnings, hasEval } = validateSkillFile(t);
    if (hasEval) withEval++;
    const rel = t.startsWith(REPO + "/") ? t.slice(REPO.length + 1) : t;
    if (errors.length) {
      failed++;
      console.log(`  FAIL ${rel}`);
      for (const e of errors) console.log(`       ✗ ${e}`);
    } else if (warnings.length) {
      warned++;
      console.log(`  warn ${rel}`);
      for (const w of warnings) console.log(`       ! ${w}`);
    } else {
      console.log(`  ok   ${rel}`);
    }
  }
  console.log(`\nskills: ${targets.length - failed}/${targets.length} valid${warned ? `, ${warned} with warnings` : ""}`);
  const pct = targets.length ? Math.round((withEval / targets.length) * 100) : 0;
  console.log(`eval coverage: ${withEval}/${targets.length} skills carry a failing-baseline eval (${pct}%)`);

  let selftestOk = true;
  if (!explicit) {
    console.log("");
    selftestOk = runSelftest();
  }
  process.exit(failed || !selftestOk ? 1 : 0);
}
