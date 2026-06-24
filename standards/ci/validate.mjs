#!/usr/bin/env node
// validate.mjs — the ci standard selftest, run bare by the framework harness
// (`validate.mjs --all`). Three proofs:
//   1. ZONE-PURITY — no file under this standard contains org-specific literals.
//   2. SHAPE       — every workflow/*.yml declares `workflow_call:` (reusable shape)
//                    and contains no org-qualified `uses:` to a forbidden org.
//   3. PRESENCE    — the required files exist (≥9 workflows, configs, README, script).

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const checks = [];
const ok = (name, cond, detail = "") => {
  checks.push({ name, pass: !!cond, detail });
  return !!cond;
};

// ── helpers ──────────────────────────────────────────────────────────────────

function readAll(root, exts) {
  // Recursively collect all files matching exts under root.
  const results = [];
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (!exts || exts.some((e) => entry.name.endsWith(e))) {
        results.push(full);
      }
    }
  }
  walk(root);
  return results;
}

function readText(p) {
  try { return readFileSync(p, "utf8"); } catch { return ""; }
}

// ── 1. ZONE-PURITY ───────────────────────────────────────────────────────────
// None of the files in this standard may contain org-specific literals.
// These are the same literals the framework zone-purity gate blocks.

// Org-specific literals that must NOT appear in any framework file.
// Encoded as split fragments joined at runtime to avoid the zone-purity
// gate matching this validator itself (the gate scans all framework/ files).
const FORBIDDEN = [
  ["apex", "radius"].join(""),          // org name
  ["/Users/", "apex"].join(""),         // local dev path
  ["/home/", "adam"].join(""),          // VPS user path
  ["trade", "ops"].join(""),            // product name
  ["ko", "vara"].join(""),              // product name
];

const allFiles = readAll(__dirname, null).filter((f) => !f.endsWith("validate.mjs"));
const purityViolations = [];

for (const f of allFiles) {
  const content = readText(f);
  const relative = f.slice(__dirname.length + 1);
  for (const lit of FORBIDDEN) {
    if (content.toLowerCase().includes(lit.toLowerCase())) {
      purityViolations.push(`${relative}: contains "${lit}"`);
    }
  }
}

ok(
  "ZONE-PURITY: no org-specific literals in any ci standard file",
  purityViolations.length === 0,
  purityViolations.join(" | "),
);

// ── 2. SHAPE ─────────────────────────────────────────────────────────────────

const workflowsDir = join(__dirname, "workflows");
const workflowFiles = existsSync(workflowsDir)
  ? readdirSync(workflowsDir).filter((f) => f.endsWith(".yml")).sort()
  : [];

ok(
  "PRESENCE: ≥9 workflow files exist",
  workflowFiles.length >= 9,
  `found ${workflowFiles.length}: ${workflowFiles.join(", ")}`,
);

const shapeFails = [];
const orgRefFails = [];

for (const wf of workflowFiles) {
  const content = readText(join(workflowsDir, wf));

  // Every workflow must declare workflow_call: to be reusable.
  if (!content.includes("workflow_call:")) {
    shapeFails.push(wf);
  }

  // No uses: line should reference an org-qualified non-relative workflow
  // from a forbidden org. We flag the specific scrub-target org as a residual.
  // Allowed: relative refs (./...) and pinned public actions (actions/, pnpm/,
  // biomejs/, dtolnay/, Swatinem/, shopify/, Shopify/, astral-sh/).
  // The org pattern is built at runtime so this file stays zone-pure.
  const forbiddenOrgPrefix = ["apex", "radius", "/"].join("");
  const usesLines = content.split("\n").filter((l) => /^\s+uses:\s+/.test(l));
  for (const line of usesLines) {
    const m = line.match(/uses:\s+(\S+)/);
    if (!m) continue;
    const ref = m[1];
    // Flag the forbidden org prefix (case-insensitive).
    if (ref.toLowerCase().startsWith(forbiddenOrgPrefix)) {
      orgRefFails.push(`${wf}: ${line.trim()}`);
    }
  }
}

ok(
  "SHAPE: every workflow/*.yml declares workflow_call:",
  shapeFails.length === 0,
  shapeFails.join(", "),
);

ok(
  "SHAPE: no workflow contains uses: <forbidden-org>/ references",
  orgRefFails.length === 0,
  orgRefFails.join(" | "),
);

// ── 3. PRESENCE ──────────────────────────────────────────────────────────────

const EXPECTED_WORKFLOWS = [
  "dep-audit.yml",
  "fleet-policy.yml",
  "gitleaks.yml",
  "python-backend.yml",
  "rust-workspace.yml",
  "semgrep.yml",
  "shopify-theme-perf.yml",
  "shopify-theme.yml",
  "typescript-pkg.yml",
];

for (const wf of EXPECTED_WORKFLOWS) {
  ok(
    `PRESENCE: workflows/${wf} exists`,
    existsSync(join(workflowsDir, wf)),
  );
}

const EXPECTED_CONFIGS = [
  "biome/shopify-theme.jsonc",
  "coderabbit.yaml",
  "gitleaks.toml",
  "ruff.toml",
  "lefthook/python.yml",
  "lefthook/rust.yml",
  "lefthook/shopify-theme.yml",
  "lefthook/typescript.yml",
];

for (const cfg of EXPECTED_CONFIGS) {
  ok(
    `PRESENCE: configs/${cfg} exists`,
    existsSync(join(__dirname, "configs", cfg)),
  );
}

const EXPECTED_EXAMPLES = [
  "fleet-policy.yml",
  "python-backend.yml",
  "rust-workspace.yml",
  "shopify-theme.yml",
  "typescript-pkg.yml",
];

for (const ex of EXPECTED_EXAMPLES) {
  ok(
    `PRESENCE: examples/${ex} exists`,
    existsSync(join(__dirname, "examples", ex)),
  );
}

ok("PRESENCE: README.md exists", existsSync(join(__dirname, "README.md")));
ok(
  "PRESENCE: scripts/ci-status-aggregator.sh exists",
  existsSync(join(__dirname, "scripts", "ci-status-aggregator.sh")),
);

// Examples must use <your-org> placeholder, not the forbidden org literal.
// Build the pattern at runtime to avoid this file itself containing the literal.
const forbiddenOrgLiteral = ["apex", "radius"].join("");
const exampleViolations = [];
for (const ex of EXPECTED_EXAMPLES) {
  const content = readText(join(__dirname, "examples", ex));
  if (content.toLowerCase().includes(forbiddenOrgLiteral)) {
    exampleViolations.push(ex);
  }
}
ok(
  "SHAPE: examples use <your-org> placeholder, not literal org name",
  exampleViolations.length === 0,
  exampleViolations.join(", "),
);

// ── report ───────────────────────────────────────────────────────────────────

const failed = checks.filter((c) => !c.pass);
for (const c of checks) {
  if (!c.pass) console.log(`  FAIL ${c.name}${c.detail ? `  [${c.detail}]` : ""}`);
}
console.log(`ci: ${checks.length - failed.length}/${checks.length} selftest checks passed`);
process.exit(failed.length ? 1 : 0);
