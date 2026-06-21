#!/usr/bin/env node
// framework/primitives/commands/validate.mjs — validate Claude Code slash commands.
//
//   node validate.mjs                 validate in-repo commands (.claude/commands) + run selftest
//   node validate.mjs <file.md> ...   validate specific command files
//   node validate.mjs --selftest      prove the validator with inline good/bad fixtures
//
// A command is one Markdown file: YAML frontmatter (commands.schema.json) + a prompt body.
// Commands are Claude-only and instance-level (they dispatch to specific agents/skills), so
// there is NO framework/instance zone guard here — unlike agents. Two honest layers:
//   1. FRONTMATTER -> ajv against commands.schema.json
//   2. BODY        -> code: the prompt must be non-empty (a command with no body does nothing)

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

import { parseFrontmatter } from "../_lib/frontmatter.mjs";
import { compileSchema, formatErrors } from "../_lib/schema.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..", "..", "..");
const SOURCE_DIRS = [join(REPO, ".claude", "commands")];

const schema = JSON.parse(readFileSync(join(__dirname, "commands.schema.json"), "utf8"));
const validateFrontmatter = compileSchema(schema);

// Core check on raw text — used by both file validation and the inline selftest.
export function checkCommand(raw, hint = "(text)") {
  const errors = [];
  const warnings = [];

  let parsed;
  try {
    parsed = parseFrontmatter(raw);
  } catch (e) {
    return { errors: [`frontmatter: ${e.message}`], warnings };
  }
  const { data, body, hasFrontmatter } = parsed;

  if (!hasFrontmatter) errors.push("no frontmatter block (a command needs at least a description)");

  if (!validateFrontmatter(data)) {
    for (const line of formatErrors(validateFrontmatter.errors)) errors.push(`frontmatter ${line}`);
  }

  if (body.trim() === "") errors.push("empty body — a command must contain a prompt");

  // Soft: a body that consumes $ARGUMENTS but declares no hint is harder to use.
  if (/\$ARGUMENTS\b/.test(body) && data["argument-hint"] === undefined) {
    warnings.push("body uses $ARGUMENTS but no 'argument-hint' is declared");
  }

  return { errors, warnings, _hint: hint };
}

export function validateCommandFile(path) {
  const { errors, warnings } = checkCommand(readFileSync(path, "utf8"), path);
  return { path, errors, warnings };
}

// ── Selftest: prove the validator accepts a good command and rejects bad ones ────
function runSelftest() {
  const good = [
    "---",
    "description: Dispatch the reviewer for the current diff",
    "argument-hint: [scope]",
    "allowed-tools: Read, Grep, Bash",
    "---",
    "Review $ARGUMENTS and report severity-rated findings.",
    "",
  ].join("\n");

  const cases = [
    ["accepts a valid command", good, (r) => r.errors.length === 0],
    [
      "rejects missing description",
      "---\nargument-hint: [x]\n---\nbody here\n",
      (r) => r.errors.some((e) => /description/.test(e)),
    ],
    [
      "rejects an unknown frontmatter key",
      "---\ndescription: x\nbogus: 1\n---\nbody here\n",
      (r) => r.errors.some((e) => /frontmatter/.test(e)),
    ],
    [
      "rejects an empty body",
      "---\ndescription: does a thing\n---\n\n",
      (r) => r.errors.some((e) => /empty body/.test(e)),
    ],
    [
      "rejects no frontmatter at all",
      "just a body, no fences\n",
      (r) => r.errors.some((e) => /no frontmatter/.test(e)),
    ],
    [
      "warns on $ARGUMENTS without an argument-hint",
      "---\ndescription: x\n---\nUse $ARGUMENTS here\n",
      (r) => r.errors.length === 0 && r.warnings.some((w) => /argument-hint/.test(w)),
    ],
  ];

  let pass = 0;
  for (const [name, raw, ok] of cases) {
    const res = checkCommand(raw, name);
    const good = ok(res);
    if (good) pass++;
    console.log(`  ${good ? "ok  " : "FAIL"} ${name}`);
  }
  console.log(`\ncommands selftest: ${pass}/${cases.length} passed`);
  return pass === cases.length;
}

function collectTargets(args) {
  const files = args.filter((a) => !a.startsWith("--"));
  if (files.length) return files;
  const out = [];
  for (const dir of SOURCE_DIRS) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (f.endsWith(".md") && f !== "README.md") out.push(join(dir, f));
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
  for (const t of targets) {
    const { errors, warnings } = validateCommandFile(t);
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
  console.log(`\ncommands: ${targets.length - failed}/${targets.length} valid${warned ? `, ${warned} with warnings` : ""}`);

  // On a bare run (no explicit files) the source tree is empty until commands are
  // ported, so ALSO run the selftest — keeps `--all` non-vacuous on a fresh clone.
  let selftestOk = true;
  if (!explicit) {
    console.log("");
    selftestOk = runSelftest();
  }
  process.exit(failed || !selftestOk ? 1 : 0);
}
