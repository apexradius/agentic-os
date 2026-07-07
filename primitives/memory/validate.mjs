#!/usr/bin/env node
// framework/primitives/memory/validate.mjs — validate memory RECORD files.
//
//   node validate.mjs                 validate in-repo *.memory.md records + selftest
//   node validate.mjs <file> ...      validate specific record files (e.g. an external record store)
//   node validate.mjs --selftest      prove the validator with inline good/bad fixtures
//
// A memory record is one durable fact per file: YAML frontmatter (memory.schema.json) + a markdown
// body (the fact + why it matters). The tier enum is the canonical persistence-stack taxonomy
// (framework/loop/context.md). Like skills the format is host-neutral — no emit/projection; an
// instance mirrors its record store to where each runtime reads. Two honest layers:
//   1. FRONTMATTER    -> ajv against memory.schema.json (OPEN schema; see spec.md)
//   2. BODY + X-FIELD -> code: non-empty body; verified-required-for-long-lived; no secrets; the
//                        name==slug convention; the legacy metadata.type -> tier nudge.

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseFrontmatter } from "../_lib/frontmatter.mjs";
import { compileSchema, formatErrors } from "../_lib/schema.mjs";
import { couplingMatch, GENERIC_COUPLING } from "../_lib/zone-coupling.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const NESTED_REPO = join(__dirname, "..", "..", "..");
const EXTRACTED_REPO = join(__dirname, "..", "..");
const REPO = existsSync(join(NESTED_REPO, "framework")) ? NESTED_REPO : EXTRACTED_REPO;
const FRAMEWORK_ROOT = join(REPO, "framework");

// The persistence-stack layers (context.md), minus skills (its own primitive). A fact lives in one.
const VALID_TIERS = new Set(["standing", "lesson", "user-model", "session", "reference"]);
// Long-lived tiers must carry a freshness date; session is transient and does not.
const LONG_LIVED = new Set(["standing", "lesson", "user-model", "reference"]);
// Legacy auto-memory `metadata.type` vocabulary -> canonical `tier` (the C1 mapping, named inline).
const LEGACY_TIER_MAP = { user: "user-model", feedback: "lesson", project: "standing", reference: "reference" };

// No secrets in a durable, re-read, possibly-synced record — ever. High-confidence shapes only
// (low false-positive): private-key headers, AWS keys, OpenAI/GitHub/Slack tokens, and an
// assignment of a secret-looking value. The rule is absolute regardless of what the scan catches.
const SECRET_RX =
  /(-----BEGIN[A-Z ]*PRIVATE KEY-----|\bAKIA[0-9A-Z]{16}\b|\bsk-[A-Za-z0-9_-]{16,}\b|\bgh[pousr]_[A-Za-z0-9]{20,}\b|\bxox[baprs]-[A-Za-z0-9-]{10,}\b|(?:password|passwd|secret|api[_-]?key|token)\s*[:=]\s*['"]?[A-Za-z0-9_\-\/+.]{8,})/i;

const schema = JSON.parse(readFileSync(join(__dirname, "memory.schema.json"), "utf8"));
const validateFrontmatter = compileSchema(schema);

// Coerce a `verified` value to a YYYY-MM-DD string. YAML 1.2 core keeps ISO dates as strings, but a
// Date can slip in under a 1.1 schema — normalize both so the check never trips on the representation.
function verifiedString(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return v == null ? "" : String(v);
}

// Core check on raw text — used by both file validation and the inline selftest.
// `slug` is the record's filename slug (for the name==slug convention); null skips that check.
export function checkMemory(raw, slug = null) {
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

  // Tier: name the canonical mapping for a known legacy value (C1 rider — a remedy that names the fix).
  if (data.tier && !VALID_TIERS.has(data.tier)) {
    const mapped = LEGACY_TIER_MAP[data.tier];
    errors.push(
      mapped
        ? `tier '${data.tier}' is not canonical — map to tier: ${mapped}`
        : `tier '${data.tier}' is not canonical (one of: ${[...VALID_TIERS].join(", ")})`,
    );
  }

  // Freshness-over-faith: long-lived records must carry a verified date; session must not (warned).
  const v = verifiedString(data.verified);
  if (LONG_LIVED.has(data.tier) && !v) {
    errors.push(`tier '${data.tier}' is long-lived and must carry a 'verified' date (YYYY-MM-DD)`);
  }
  if (data.tier === "session" && v) {
    warnings.push("a 'session' record is transient — a 'verified' date is meaningless here");
  }

  if (body.trim() === "") errors.push("empty body — a record must state the fact and why it matters");

  // No secrets — scan the whole record (frontmatter + body).
  if (SECRET_RX.test(raw)) {
    errors.push("a memory record must never contain a secret (token/key/password/private-key) — remove it");
  }

  // Convention (warning): name should equal the filename slug.
  if (slug && data.name && data.name !== slug) {
    warnings.push(`name '${data.name}' != filename slug '${slug}'`);
  }

  // Legacy taxonomy nudge (C1): a record still carrying metadata.type should migrate to top-level tier.
  const legacyType = data.metadata && typeof data.metadata === "object" ? data.metadata.type : undefined;
  if (legacyType) {
    const mapped = LEGACY_TIER_MAP[legacyType];
    warnings.push(
      `legacy metadata.type: ${legacyType} — migrate to tier: ${mapped ?? "<one of standing|lesson|user-model|session|reference>"}`,
    );
  }

  return { errors, warnings };
}

// A framework/-zone record must be coupling-free — a memory record is instance state, so a coupled
// record under framework/ is misplaced. Mirrors the skills/agents zone guard.
function checkZone(path, raw, errors) {
  const abs = resolve(path);
  if (!abs.startsWith(`${FRAMEWORK_ROOT}/`)) return;
  const hit = couplingMatch([raw]);
  if (hit) {
    errors.push(`a framework/ memory record must be Apex-free, but contains '${hit}' — route it to the instance store`);
  }
}

function slugOf(path) {
  const b = basename(path);
  return b.endsWith(".memory.md") ? b.slice(0, -".memory.md".length) : b.replace(/\.md$/, "");
}

export function validateMemoryFile(path) {
  const raw = readFileSync(path, "utf8");
  const { errors, warnings } = checkMemory(raw, slugOf(path));
  checkZone(path, raw, errors);
  return { path, errors, warnings };
}

// ── Selftest: prove the validator accepts a good record and rejects each violation ──────
function runSelftest() {
  const good = [
    "---",
    "name: three-apps-not-a-crm",
    "description: We ship exactly 3 apps; a legacy DB name is not a product category.",
    "tier: standing",
    "verified: 2026-07-05",
    "---",
    "The three apps are A, B, and C. A legacy database name is not a fourth product.",
    "",
  ].join("\n");

  const cases = [
    ["accepts a valid record", good, "three-apps-not-a-crm", (r) => r.errors.length === 0],
    [
      "accepts an unknown frontmatter key (open schema)",
      "---\nname: x\ndescription: does y\ntier: standing\nverified: 2026-07-05\noriginSessionId: abc-123\n---\nbody\n",
      "x",
      (r) => r.errors.length === 0,
    ],
    [
      "rejects missing name",
      "---\ndescription: does y\ntier: standing\nverified: 2026-07-05\n---\nbody\n",
      null,
      (r) => r.errors.some((e) => /name/.test(e)),
    ],
    [
      "rejects missing tier",
      "---\nname: x\ndescription: does y\n---\nbody\n",
      "x",
      (r) => r.errors.some((e) => /tier/.test(e)),
    ],
    [
      "rejects a non-kebab name",
      "---\nname: Three_Apps\ndescription: does y\ntier: standing\nverified: 2026-07-05\n---\nbody\n",
      null,
      (r) => r.errors.some((e) => /name|pattern/.test(e)),
    ],
    [
      "rejects angle brackets in description",
      "---\nname: x\ndescription: emits <html>\ntier: standing\nverified: 2026-07-05\n---\nbody\n",
      "x",
      (r) => r.errors.some((e) => /description|pattern/.test(e)),
    ],
    [
      "rejects a non-canonical tier and names the mapping",
      "---\nname: x\ndescription: does y\ntier: feedback\nverified: 2026-07-05\n---\nbody\n",
      "x",
      (r) => r.errors.some((e) => /map to tier: lesson/.test(e)),
    ],
    [
      "rejects a malformed verified date",
      "---\nname: x\ndescription: does y\ntier: standing\nverified: last week\n---\nbody\n",
      "x",
      (r) => r.errors.some((e) => /verified|pattern/.test(e)),
    ],
    [
      "rejects a long-lived record with no verified date",
      "---\nname: x\ndescription: does y\ntier: standing\n---\nbody\n",
      "x",
      (r) => r.errors.some((e) => /long-lived.*verified/.test(e)),
    ],
    [
      "accepts a session record with no verified date",
      "---\nname: x\ndescription: mid-task state\ntier: session\n---\nresume from step 3\n",
      "x",
      (r) => r.errors.length === 0,
    ],
    [
      "warns a session record that carries a verified date",
      "---\nname: x\ndescription: mid-task state\ntier: session\nverified: 2026-07-05\n---\nresume\n",
      "x",
      (r) => r.errors.length === 0 && r.warnings.some((w) => /session.*verified|verified.*meaningless/.test(w)),
    ],
    [
      "rejects an empty body",
      "---\nname: x\ndescription: does y\ntier: standing\nverified: 2026-07-05\n---\n\n",
      "x",
      (r) => r.errors.some((e) => /empty body/.test(e)),
    ],
    [
      "warns when name != filename slug",
      good,
      "different-slug",
      (r) => r.errors.length === 0 && r.warnings.some((w) => /!= filename slug/.test(w)),
    ],
    [
      "rejects a secret in the body",
      "---\nname: x\ndescription: does y\ntier: standing\nverified: 2026-07-05\n---\ntoken sk-FAKE00000000000000000000 is here\n",
      "x",
      (r) => r.errors.some((e) => /secret/.test(e)),
    ],
    [
      "warns a legacy metadata.type and names the mapping",
      "---\nname: x\ndescription: does y\ntier: standing\nverified: 2026-07-05\nmetadata:\n  type: feedback\n---\nbody\n",
      "x",
      (r) => r.errors.length === 0 && r.warnings.some((w) => /legacy metadata\.type.*tier: lesson/.test(w)),
    ],
  ];

  let pass = 0;
  for (const [name, raw, slug, ok] of cases) {
    const res = checkMemory(raw, slug);
    const good2 = ok(res);
    if (good2) pass++;
    console.log(`  ${good2 ? "ok  " : "FAIL"} ${name}`);
  }

  // Zone guard: the coupling arbiter must FIRE on coupling tokens and PASS clean generic text — a
  // reject-coupled fixture proves the guard isn't vacuous (generic fixtures, GENERIC_COUPLING.skills).
  const zoneCases = [
    ["zone: flags a hardcoded host", "the box at 198.51.100.7", (h) => h !== null],
    ["zone: flags an org reference", "sync the acme client roster", (h) => h !== null],
    ["zone: passes clean generic text", "a durable fact about how caches invalidate", (h) => h === null],
  ];
  for (const [name, text, ok] of zoneCases) {
    const good2 = ok(couplingMatch([text], GENERIC_COUPLING.skills));
    if (good2) pass++;
    console.log(`  ${good2 ? "ok  " : "FAIL"} ${name}`);
  }

  const total = cases.length + zoneCases.length;
  console.log(`\nmemory selftest: ${pass}/${total} passed`);
  return pass === total;
}

// In-repo records self-identify as <slug>.memory.md (so an aggregate memory.md is never mistaken for
// a record). Walk the tree collecting them; skip vendored/VCS trees.
const SKIP_DIRS = new Set(["node_modules", ".git"]);
function collectRepoRecords(root, out) {
  let entries;
  try { entries = readdirSync(root, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      collectRepoRecords(join(root, e.name), out);
    } else if (e.isFile() && e.name.endsWith(".memory.md")) {
      out.push(join(root, e.name));
    }
  }
}

function collectTargets(args) {
  const files = args.filter((a) => !a.startsWith("--"));
  if (files.length) return files;
  const out = [];
  collectRepoRecords(REPO, out);
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
    const { errors, warnings } = validateMemoryFile(t);
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
  console.log(`\nmemory: ${targets.length - failed}/${targets.length} record(s) valid${warned ? `, ${warned} with warnings` : ""}`);

  let selftestOk = true;
  if (!explicit) {
    console.log("");
    selftestOk = runSelftest();
  }
  process.exit(failed || !selftestOk ? 1 : 0);
}
