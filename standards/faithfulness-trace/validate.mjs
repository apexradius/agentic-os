#!/usr/bin/env node
// validate.mjs — faithfulness-trace standard. It checks the closeout trace
// artifact shape: every done claim must carry evidence with a pointer and observed
// result. It does not judge whether the evidence is sufficient.

import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const checks = [];
const ok = (name, cond, detail = "") => { checks.push({ name, pass: !!cond, detail }); return !!cond; };
const TYPES = new Set(["tool", "command", "artifact", "observed-output"]);
const CLAIM_KINDS = new Set([
  "validation-passed",
  "deployed",
  "pushed",
  "committed",
  "artifact-created",
  "runtime-observed",
  "not-verified",
]);
const CLAIM_KIND_HINTS = [
  ["validation-passed", /\b(validate|validator|validation|test|tests|checks?)\b.*\b(pass|passed|green|valid)\b/i],
  ["deployed", /\b(deploy|deployed|released|installed)\b/i],
  ["pushed", /\b(push|pushed)\b/i],
  ["committed", /\b(commit|committed)\b/i],
  ["artifact-created", /\b(artifact|file|report|trace)\b.*\b(created|written|emitted)\b/i],
  ["runtime-observed", /\b(observed|verified live|runtime|endpoint|service)\b/i],
];

function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasTimestamp(value) {
  return hasText(value) && Number.isFinite(Date.parse(value));
}

function hintedClaimKind(claim) {
  for (const [kind, re] of CLAIM_KIND_HINTS) if (re.test(claim)) return kind;
  return "";
}

function evidencePointer(evidence) {
  return hasText(evidence.ref) || hasText(evidence.command) || hasText(evidence.tool);
}

function hasZeroExit(evidence) {
  return evidence.exit_code === 0 || evidence.exitCode === 0;
}

function validateKindEvidence(kind, evidence, where) {
  const errors = [];
  if (kind === "validation-passed") {
    if (evidence.type !== "command") errors.push(`${where}.evidence.type must be command for validation-passed`);
    if (!hasText(evidence.command) && !hasText(evidence.ref)) errors.push(`${where}.evidence.command or ref is required for validation-passed`);
    if (!hasZeroExit(evidence)) errors.push(`${where}.evidence.exit_code must be 0 for validation-passed`);
  } else if (kind === "deployed") {
    if (!["command", "tool", "observed-output"].includes(evidence.type)) {
      errors.push(`${where}.evidence.type must be command, tool, or observed-output for deployed`);
    }
    if (!hasText(evidence.service) && !hasText(evidence.endpoint) && !hasText(evidence.runtime_ref)) {
      errors.push(`${where}.evidence requires service, endpoint, or runtime_ref for deployed`);
    }
  } else if (kind === "pushed") {
    if (!hasText(evidence.git_ref)) errors.push(`${where}.evidence.git_ref is required for pushed`);
    if (!hasText(evidence.remote)) errors.push(`${where}.evidence.remote is required for pushed`);
  } else if (kind === "committed") {
    if (!hasText(evidence.git_ref)) errors.push(`${where}.evidence.git_ref is required for committed`);
  } else if (kind === "artifact-created") {
    if (!hasText(evidence.artifact_path) && !hasText(evidence.ref)) {
      errors.push(`${where}.evidence.artifact_path or ref is required for artifact-created`);
    }
  } else if (kind === "runtime-observed") {
    if (!["tool", "command", "observed-output"].includes(evidence.type)) {
      errors.push(`${where}.evidence.type must be tool, command, or observed-output for runtime-observed`);
    }
  } else if (kind === "not-verified") {
    if (!hasText(evidence.missing_evidence) && !hasText(evidence.blocked_reason)) {
      errors.push(`${where}.evidence.missing_evidence or blocked_reason is required for not-verified`);
    }
  }
  return errors;
}

export function validateTrace(trace) {
  const errors = [];
  if (!isObject(trace)) return ["trace is not an object"];
  if (!Array.isArray(trace.claims) || trace.claims.length === 0) {
    errors.push("claims must be a non-empty array");
    return errors;
  }

  trace.claims.forEach((entry, index) => {
    const where = `claims[${index}]`;
    if (!isObject(entry)) {
      errors.push(`${where} is not an object`);
      return;
    }
    if (!hasText(entry.claim)) errors.push(`${where}.claim is required`);
    const kind = entry.claim_kind;
    if (kind !== undefined && !CLAIM_KINDS.has(kind)) errors.push(`${where}.claim_kind is invalid`);
    if (kind === undefined) {
      const hinted = hintedClaimKind(entry.claim || "");
      if (hinted) errors.push(`${where}.claim_kind is required for ${hinted} claims`);
    }
    const evidence = entry.evidence;
    if (!isObject(evidence)) {
      errors.push(`${where}.evidence is required`);
      return;
    }
    if (!TYPES.has(evidence.type)) errors.push(`${where}.evidence.type is invalid`);
    if (!evidencePointer(evidence)) {
      errors.push(`${where}.evidence requires ref, command, or tool`);
    }
    if (!hasText(evidence.observed)) errors.push(`${where}.evidence.observed is required`);
    if (!hasTimestamp(evidence.timestamp)) errors.push(`${where}.evidence.timestamp is invalid`);
    if (CLAIM_KINDS.has(kind)) errors.push(...validateKindEvidence(kind, evidence, where));
  });
  return errors;
}

const valid = {
  claims: [
    {
      claim: "Validator passes",
      claim_kind: "validation-passed",
      evidence: {
        type: "command",
        command: "node framework/primitives/_lib/validate.mjs --all",
        exit_code: 0,
        observed: "Exited 0 and printed ALL VALID",
        timestamp: "2026-06-25T18:00:00Z",
      },
    },
  ],
};
const legacyReadable = {
  claims: [
    {
      claim: "Reviewed the artifact",
      evidence: {
        type: "artifact",
        ref: "reports/review.md",
        observed: "Report exists and is non-empty",
        timestamp: "2026-06-25T18:00:00Z",
      },
    },
  ],
};
const missingEvidence = { claims: [{ claim: "Done" }] };
const genericDeploy = {
  claims: [
    {
      claim: "Deployed the service",
      claim_kind: "deployed",
      evidence: {
        type: "observed-output",
        ref: "closeout note",
        observed: "Looks done",
        timestamp: "2026-06-25T18:00:00Z",
      },
    },
  ],
};
const pushed = {
  claims: [
    {
      claim: "Pushed main",
      claim_kind: "pushed",
      evidence: {
        type: "command",
        command: "git push",
        git_ref: "abc1234",
        remote: "origin/main",
        observed: "origin/main updated to abc1234",
        timestamp: "2026-06-25T18:00:00Z",
      },
    },
  ],
};
const badType = {
  claims: [
    {
      claim: "Done",
      evidence: {
        type: "guess",
        ref: "somewhere",
        observed: "Looked fine",
        timestamp: "2026-06-25T18:00:00Z",
      },
    },
  ],
};

ok("validateTrace: evidence-backed claim passes", validateTrace(valid).length === 0);
ok("validateTrace: legacy claim/evidence shape remains readable", validateTrace(legacyReadable).length === 0);
ok("validateTrace: claim without evidence fails", validateTrace(missingEvidence).some((e) => /evidence/.test(e)));
ok("validateTrace: deployed claim with generic evidence fails", validateTrace(genericDeploy).some((e) => /service|endpoint|runtime_ref/.test(e)));
ok("validateTrace: pushed claim with git evidence passes", validateTrace(pushed).length === 0);
ok("validateTrace: invalid evidence type fails", validateTrace(badType).some((e) => /type/.test(e)));
ok("file present: validate.mjs", existsSync(join(__dirname, "validate.mjs")));
ok("file present: README.md", existsSync(join(__dirname, "README.md")));

const failed = checks.filter((c) => !c.pass);
for (const c of checks) if (!c.pass) console.log(`  FAIL ${c.name}${c.detail ? `  [${c.detail}]` : ""}`);
console.log(`faithfulness-trace: ${checks.length - failed.length}/${checks.length} selftest checks passed`);
process.exit(failed.length ? 1 : 0);
