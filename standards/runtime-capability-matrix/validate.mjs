#!/usr/bin/env node
// validate.mjs — runtime capability matrix standard, run bare or by `validate.mjs --all`.
// Proves framework/runtime/capabilities.json is executable contract, not decorative docs:
// every runtime declares the required primitive support keys and every validator finding
// shape carries the remediation field repair loops need.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRAMEWORK = join(__dirname, "..", "..");
const RUNTIME = join(FRAMEWORK, "runtime");
const MATRIX_PATH = join(RUNTIME, "capabilities.json");
const SCHEMA_PATH = join(RUNTIME, "capabilities.schema.json");

const REQUIRED_TOP = ["version", "status", "purpose", "validator_finding_shape", "runtimes"];
const FINDING_KEYS = ["severity", "path", "message", "fix"];
const SUPPORT_KEYS = ["agents", "skills", "commands", "hooks", "mcp", "plugins", "evals"];
const SUPPORT_VALUES = ["native", "adapter", "framework", "plugin", "partial", "none"];
const RUNTIME_ID = /^[a-z0-9][a-z0-9-]*$/;

const checks = [];
const ok = (name, cond, detail = "") => { checks.push({ name, pass: !!cond, detail }); return !!cond; };

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJson(text, label) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, error: `${label} JSON parse failed: ${error.message}` };
  }
}

export function validateMatrix(matrix) {
  const errors = [];
  if (!isObject(matrix)) return ["matrix must be an object"];

  const allowedTop = new Set(["$schema", ...REQUIRED_TOP]);
  for (const key of Object.keys(matrix)) if (!allowedTop.has(key)) errors.push(`unexpected top-level key: ${key}`);
  for (const key of REQUIRED_TOP) if (!(key in matrix)) errors.push(`missing top-level key: ${key}`);

  if (!Number.isInteger(matrix.version) || matrix.version < 1) errors.push("version must be an integer >= 1");
  if (!["stub", "active"].includes(matrix.status)) errors.push("status must be stub or active");
  if (typeof matrix.purpose !== "string" || matrix.purpose.trim() === "") errors.push("purpose must be a non-empty string");

  if (!isObject(matrix.validator_finding_shape)) {
    errors.push("validator_finding_shape must be an object");
  } else {
    const allowed = new Set(FINDING_KEYS);
    for (const key of Object.keys(matrix.validator_finding_shape)) if (!allowed.has(key)) errors.push(`unexpected finding field: ${key}`);
    for (const key of FINDING_KEYS) {
      if (typeof matrix.validator_finding_shape[key] !== "string" || matrix.validator_finding_shape[key].trim() === "") {
        errors.push(`validator_finding_shape.${key} must be a non-empty string`);
      }
    }
  }

  if (!Array.isArray(matrix.runtimes) || matrix.runtimes.length === 0) {
    errors.push("runtimes must be a non-empty array");
    return errors;
  }

  const ids = new Set();
  matrix.runtimes.forEach((runtime, index) => {
    const prefix = `runtimes[${index}]`;
    if (!isObject(runtime)) {
      errors.push(`${prefix} must be an object`);
      return;
    }
    if (typeof runtime.id !== "string" || !RUNTIME_ID.test(runtime.id)) errors.push(`${prefix}.id must be lowercase id text`);
    else if (ids.has(runtime.id)) errors.push(`${prefix}.id duplicates ${runtime.id}`);
    else ids.add(runtime.id);
    if (typeof runtime.label !== "string" || runtime.label.trim() === "") errors.push(`${prefix}.label must be a non-empty string`);
    if (!isObject(runtime.support)) {
      errors.push(`${prefix}.support must be an object`);
      return;
    }
    for (const key of SUPPORT_KEYS) if (!(key in runtime.support)) errors.push(`${prefix}.support missing ${key}`);
    for (const [key, value] of Object.entries(runtime.support)) {
      if (!SUPPORT_KEYS.includes(key)) errors.push(`${prefix}.support unexpected key ${key}`);
      if (!SUPPORT_VALUES.includes(value)) errors.push(`${prefix}.support.${key} has invalid value ${value}`);
    }
  });

  return errors;
}

export function validateSchemaAgreement(schema) {
  const errors = [];
  if (!isObject(schema)) return ["schema must be an object"];
  const required = Array.isArray(schema.required) ? schema.required : [];
  for (const key of REQUIRED_TOP) if (!required.includes(key)) errors.push(`schema.required missing ${key}`);

  const supportEnum = schema.properties?.runtimes?.items?.properties?.support?.additionalProperties?.enum;
  if (!Array.isArray(supportEnum)) {
    errors.push("schema support enum is missing");
  } else {
    const got = [...supportEnum].sort().join(",");
    const expected = [...SUPPORT_VALUES].sort().join(",");
    if (got !== expected) errors.push(`schema support enum mismatch: ${got}`);
  }
  return errors;
}

// Selftest: RED/GREEN inline matrices prove the helpers fail loudly.
const support = Object.fromEntries(SUPPORT_KEYS.map((key) => [key, "native"]));
const good = { version: 1, status: "stub", purpose: "x", validator_finding_shape: Object.fromEntries(FINDING_KEYS.map((key) => [key, "x"])), runtimes: [{ id: "codex-local", label: "Codex local", support }] };
ok("validateMatrix: clean fixture passes", validateMatrix(good).length === 0, validateMatrix(good).join(" | "));
ok("validateMatrix: missing fix fails", validateMatrix({ ...good, validator_finding_shape: { severity: "x", path: "x", message: "x" } }).some((e) => e.includes("fix")));
ok("validateMatrix: duplicate runtime id fails", validateMatrix({ ...good, runtimes: [good.runtimes[0], good.runtimes[0]] }).some((e) => e.includes("duplicates")));
ok("validateMatrix: missing support key fails", validateMatrix({ ...good, runtimes: [{ id: "x", label: "x", support: { agents: "native" } }] }).some((e) => e.includes("support missing skills")));
ok("validateMatrix: invalid support value fails", validateMatrix({ ...good, runtimes: [{ id: "x", label: "x", support: { ...support, hooks: "magic" } }] }).some((e) => e.includes("invalid value")));
ok("validateSchemaAgreement: clean schema passes", validateSchemaAgreement({ required: REQUIRED_TOP, properties: { runtimes: { items: { properties: { support: { additionalProperties: { enum: SUPPORT_VALUES } } } } } } }).length === 0);
ok("validateSchemaAgreement: enum mismatch fails", validateSchemaAgreement({ required: REQUIRED_TOP, properties: { runtimes: { items: { properties: { support: { additionalProperties: { enum: ["native"] } } } } } } }).some((e) => e.includes("enum mismatch")));

// Real scan.
ok("file present: runtime/capabilities.json", existsSync(MATRIX_PATH));
ok("file present: runtime/capabilities.schema.json", existsSync(SCHEMA_PATH));
if (existsSync(MATRIX_PATH)) {
  const parsed = parseJson(readFileSync(MATRIX_PATH, "utf8"), "capabilities.json");
  ok("scan: capabilities.json parses", parsed.ok, parsed.error || "");
  if (parsed.ok) ok("scan: capabilities.json satisfies contract", validateMatrix(parsed.value).length === 0, validateMatrix(parsed.value).join(" | "));
}
if (existsSync(SCHEMA_PATH)) {
  const parsed = parseJson(readFileSync(SCHEMA_PATH, "utf8"), "capabilities.schema.json");
  ok("scan: capabilities.schema.json parses", parsed.ok, parsed.error || "");
  if (parsed.ok) ok("scan: schema agrees with contract", validateSchemaAgreement(parsed.value).length === 0, validateSchemaAgreement(parsed.value).join(" | "));
}
for (const f of ["validate.mjs", "README.md"]) ok(`file present: ${f}`, existsSync(join(__dirname, f)));

const failed = checks.filter((c) => !c.pass);
for (const c of checks) if (!c.pass) console.log(`  FAIL ${c.name}${c.detail ? `  [${c.detail}]` : ""}`);
console.log(`runtime-capability-matrix: ${checks.length - failed.length}/${checks.length} selftest checks passed`);
process.exit(failed.length ? 1 : 0);
