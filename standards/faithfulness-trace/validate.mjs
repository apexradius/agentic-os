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

function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasTimestamp(value) {
  return hasText(value) && Number.isFinite(Date.parse(value));
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
    const evidence = entry.evidence;
    if (!isObject(evidence)) {
      errors.push(`${where}.evidence is required`);
      return;
    }
    if (!TYPES.has(evidence.type)) errors.push(`${where}.evidence.type is invalid`);
    if (!hasText(evidence.ref) && !hasText(evidence.command) && !hasText(evidence.tool)) {
      errors.push(`${where}.evidence requires ref, command, or tool`);
    }
    if (!hasText(evidence.observed)) errors.push(`${where}.evidence.observed is required`);
    if (!hasTimestamp(evidence.timestamp)) errors.push(`${where}.evidence.timestamp is invalid`);
  });
  return errors;
}

const valid = {
  claims: [
    {
      claim: "Validator passes",
      evidence: {
        type: "command",
        ref: "node framework/primitives/_lib/validate.mjs --all",
        observed: "Exited 0 and printed ALL VALID",
        timestamp: "2026-06-25T18:00:00Z",
      },
    },
  ],
};
const missingEvidence = { claims: [{ claim: "Done" }] };
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
ok("validateTrace: claim without evidence fails", validateTrace(missingEvidence).some((e) => /evidence/.test(e)));
ok("validateTrace: invalid evidence type fails", validateTrace(badType).some((e) => /type/.test(e)));
ok("file present: validate.mjs", existsSync(join(__dirname, "validate.mjs")));
ok("file present: README.md", existsSync(join(__dirname, "README.md")));

const failed = checks.filter((c) => !c.pass);
for (const c of checks) if (!c.pass) console.log(`  FAIL ${c.name}${c.detail ? `  [${c.detail}]` : ""}`);
console.log(`faithfulness-trace: ${checks.length - failed.length}/${checks.length} selftest checks passed`);
process.exit(failed.length ? 1 : 0);
