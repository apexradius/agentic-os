#!/usr/bin/env node
// validate.mjs — adversarial-review standard. It validates the portable review
// artifact shape: checked failure modes, evidence-backed findings, and clean-pass
// coverage. It does not judge whether the review's reasoning is correct.

import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const checks = [];
const ok = (name, cond, detail = "") => { checks.push({ name, pass: !!cond, detail }); return !!cond; };

const REQUIRED_FAILURE_MODES = [
  "hallucinated-surface",
  "plausible-but-wrong",
  "silent-fallback",
  "scope-drift",
  "fabricated-verification",
  "confident-staleness",
];
const FAILURE_MODES = new Set(REQUIRED_FAILURE_MODES);
const EVIDENCE_TYPES = new Set(["tool", "command", "artifact", "observed-output"]);
const SEVERITIES = new Set(["P0", "P1", "P2", "P3", "P4", "info"]);

function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function evidencePointer(evidence) {
  return hasText(evidence.ref) || hasText(evidence.command) || hasText(evidence.tool) || hasText(evidence.artifact_path);
}

function hasEvidence(evidence) {
  return isObject(evidence) &&
    EVIDENCE_TYPES.has(evidence.type) &&
    evidencePointer(evidence) &&
    hasText(evidence.observed);
}

function missingRequiredModes(modes) {
  const seen = new Set(modes);
  return REQUIRED_FAILURE_MODES.filter((mode) => !seen.has(mode));
}

function validateEvidence(evidence, where, errors) {
  if (!isObject(evidence)) {
    errors.push(`${where}.evidence is required`);
    return;
  }
  if (!EVIDENCE_TYPES.has(evidence.type)) errors.push(`${where}.evidence.type is invalid`);
  if (!evidencePointer(evidence)) errors.push(`${where}.evidence requires ref, command, tool, or artifact_path`);
  if (!hasText(evidence.observed)) errors.push(`${where}.evidence.observed is required`);
}

export function validateReview(review) {
  const errors = [];
  if (!isObject(review)) return ["review is not an object"];
  if (!hasText(review.id)) errors.push("id is required");
  if (!Array.isArray(review.checked_failure_modes) || review.checked_failure_modes.length === 0) {
    errors.push("checked_failure_modes must be a non-empty array");
  } else {
    review.checked_failure_modes.forEach((mode, index) => {
      if (!FAILURE_MODES.has(mode)) errors.push(`checked_failure_modes[${index}] is invalid`);
    });
  }

  const checked = new Set(Array.isArray(review.checked_failure_modes) ? review.checked_failure_modes : []);
  if (!Array.isArray(review.findings)) {
    errors.push("findings must be an array");
  } else {
    review.findings.forEach((finding, index) => {
      const where = `findings[${index}]`;
      if (!isObject(finding)) {
        errors.push(`${where} is not an object`);
        return;
      }
      if (!FAILURE_MODES.has(finding.failure_mode)) {
        errors.push(`${where}.failure_mode is invalid`);
      } else if (!checked.has(finding.failure_mode)) {
        errors.push(`${where}.failure_mode was not checked`);
      }
      if (!SEVERITIES.has(finding.severity)) errors.push(`${where}.severity is invalid`);
      if (!hasText(finding.summary)) errors.push(`${where}.summary is required`);
      validateEvidence(finding.evidence, where, errors);
    });
  }

  if (review.clean_pass !== true && review.clean_pass !== false) {
    errors.push("clean_pass must be boolean");
  }
  if (review.clean_pass === true && Array.isArray(review.findings) && review.findings.length > 0) {
    errors.push("clean_pass cannot be true when findings are present");
  }
  if (review.clean_pass === true) {
    const missing = missingRequiredModes(review.checked_failure_modes || []);
    if (missing.length) errors.push(`clean_pass missing checked failure modes: ${missing.join(", ")}`);
    if (!Array.isArray(review.clean_pass_coverage) || review.clean_pass_coverage.length === 0) {
      errors.push("clean_pass_coverage must be a non-empty array for clean_pass reviews");
    } else {
      const coverageModes = [];
      review.clean_pass_coverage.forEach((entry, index) => {
        const where = `clean_pass_coverage[${index}]`;
        if (!isObject(entry)) {
          errors.push(`${where} is not an object`);
          return;
        }
        if (!FAILURE_MODES.has(entry.failure_mode)) {
          errors.push(`${where}.failure_mode is invalid`);
        } else {
          coverageModes.push(entry.failure_mode);
          if (!checked.has(entry.failure_mode)) errors.push(`${where}.failure_mode was not checked`);
        }
        validateEvidence(entry.evidence, where, errors);
      });
      const coverageMissing = missingRequiredModes(coverageModes);
      if (coverageMissing.length) errors.push(`clean_pass_coverage missing modes: ${coverageMissing.join(", ")}`);
    }
  }

  return errors;
}

const coverage = REQUIRED_FAILURE_MODES.map((mode) => ({
  failure_mode: mode,
  evidence: {
    type: "command",
    command: `review-check ${mode}`,
    observed: `Checked ${mode} and found no issue`,
  },
}));
const clean = {
  id: "clean-review",
  checked_failure_modes: [...REQUIRED_FAILURE_MODES],
  findings: [],
  clean_pass: true,
  clean_pass_coverage: coverage,
};
const finding = {
  id: "finding-review",
  checked_failure_modes: ["fabricated-verification"],
  findings: [
    {
      failure_mode: "fabricated-verification",
      severity: "P1",
      summary: "Closeout says tests passed but provides no command output.",
      evidence: {
        type: "artifact",
        ref: "reports/closeout.json",
        observed: "Claim lacks command, tool, or observed output evidence.",
      },
    },
  ],
  clean_pass: false,
};
const noEvidence = {
  id: "no-evidence",
  checked_failure_modes: ["plausible-but-wrong"],
  findings: [
    {
      failure_mode: "plausible-but-wrong",
      severity: "P2",
      summary: "The answer sounds plausible but contradicts the fixture.",
    },
  ],
  clean_pass: false,
};
const noCheckedModes = {
  id: "no-modes",
  checked_failure_modes: [],
  findings: [],
  clean_pass: true,
  clean_pass_coverage: [],
};
const missingCoverage = {
  id: "missing-coverage",
  checked_failure_modes: [...REQUIRED_FAILURE_MODES],
  findings: [],
  clean_pass: true,
  clean_pass_coverage: coverage.slice(0, 5),
};
const cleanWithFinding = {
  ...clean,
  id: "clean-with-finding",
  findings: finding.findings,
};

ok("validateReview: clean pass with full coverage passes", validateReview(clean).length === 0);
ok("validateReview: evidence-backed finding passes", validateReview(finding).length === 0);
ok("validateReview: finding without evidence fails", validateReview(noEvidence).some((e) => /evidence/.test(e)));
ok("validateReview: no checked failure modes fails", validateReview(noCheckedModes).some((e) => /checked_failure_modes|clean_pass/.test(e)));
ok("validateReview: clean pass missing required coverage fails", validateReview(missingCoverage).some((e) => /coverage missing modes/.test(e)));
ok("validateReview: clean pass with findings fails", validateReview(cleanWithFinding).some((e) => /clean_pass cannot/.test(e)));
ok("hasEvidence: command evidence has pointer and observation", hasEvidence({ type: "command", command: "true", observed: "exit 0" }));
ok("file present: validate.mjs", existsSync(join(__dirname, "validate.mjs")));
ok("file present: README.md", existsSync(join(__dirname, "README.md")));

let fileFailures = 0;
for (const arg of process.argv.slice(2)) {
  try {
    const parsed = JSON.parse(readFileSync(arg, "utf8"));
    const errors = validateReview(parsed);
    if (errors.length) {
      fileFailures++;
      console.log(`  FAIL ${arg}`);
      for (const e of errors) console.log(`       x ${e}`);
    } else {
      console.log(`  ok   ${arg}`);
    }
  } catch (e) {
    fileFailures++;
    console.log(`  FAIL ${arg}`);
    console.log(`       x invalid JSON: ${e.message}`);
  }
}

const failed = checks.filter((c) => !c.pass);
for (const c of failed) console.log(`  FAIL ${c.name}${c.detail ? `  [${c.detail}]` : ""}`);
console.log(`adversarial-review: ${checks.length - failed.length}/${checks.length} selftest checks passed`);
process.exit(failed.length || fileFailures ? 1 : 0);
