#!/usr/bin/env node
// validate.mjs — the judge-validity standard. Enforces doctrine/standards/judge-validity.md:
// judge agreement must be validated with chance-corrected agreement, not raw agreement alone.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", ".."); // framework/
const checks = [];
const ok = (name, cond, detail = "") => { checks.push({ name, pass: !!cond, detail }); return !!cond; };

export function cohenKappa(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) throw new Error("ratings must be arrays");
  if (a.length !== b.length) throw new Error("ratings arrays must have equal length");
  if (a.length === 0) throw new Error("ratings arrays must not be empty");
  const labels = [...new Set([...a, ...b])];
  const n = a.length;
  let agree = 0;
  const ca = new Map(), cb = new Map();
  for (let i = 0; i < n; i++) {
    if (a[i] === b[i]) agree++;
    ca.set(a[i], (ca.get(a[i]) || 0) + 1);
    cb.set(b[i], (cb.get(b[i]) || 0) + 1);
  }
  const po = agree / n;
  let pe = 0;
  for (const label of labels) pe += ((ca.get(label) || 0) / n) * ((cb.get(label) || 0) / n);
  if (pe === 1) return po === 1 ? 1 : 0;
  return (po - pe) / (1 - pe);
}

export function validateGoldSet(gold) {
  const errors = [];
  if (!gold || typeof gold !== "object" || Array.isArray(gold)) return { errors: ["gold set must be an object"], kappa: null };
  if (typeof gold.id !== "string" || !gold.id.trim()) errors.push("id is required");
  if (!Array.isArray(gold.ratings_a)) errors.push("ratings_a must be an array");
  if (!Array.isArray(gold.ratings_b)) errors.push("ratings_b must be an array");
  if (typeof gold.min_kappa !== "number") errors.push("min_kappa must be a number");
  if (errors.length) return { errors, kappa: null };
  let kappa;
  try {
    kappa = cohenKappa(gold.ratings_a, gold.ratings_b);
  } catch (err) {
    return { errors: [err.message], kappa: null };
  }
  if (gold.ratings_a.length < 4) errors.push("gold set must contain at least 4 paired ratings");
  if (kappa < gold.min_kappa) errors.push(`kappa ${kappa.toFixed(3)} is below min_kappa ${gold.min_kappa}`);
  return { errors, kappa };
}

function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name === "judge-validity-gold.json") acc.push(p);
  }
  return acc;
}

ok("cohenKappa: perfect agreement is 1", cohenKappa(["pass", "fail"], ["pass", "fail"]) === 1);
ok("cohenKappa: chance-like disagreement stays below threshold", cohenKappa(["pass", "pass", "fail", "fail"], ["pass", "fail", "pass", "fail"]) < 0.1);
let mismatchThrew = false;
try { cohenKappa(["pass"], ["pass", "fail"]); } catch { mismatchThrew = true; }
ok("cohenKappa: mismatched arrays throw", mismatchThrew);

const good = { id: "good", ratings_a: ["pass", "pass", "fail", "fail"], ratings_b: ["pass", "pass", "fail", "fail"], min_kappa: 0.6 };
const bad = { id: "bad", ratings_a: ["pass", "pass", "fail", "fail"], ratings_b: ["pass", "fail", "pass", "fail"], min_kappa: 0.6 };
ok("validateGoldSet: accepts a gold set above threshold", validateGoldSet(good).errors.length === 0);
ok("validateGoldSet: rejects a gold set below threshold", validateGoldSet(bad).errors.some((e) => e.includes("below min_kappa")));

const manifests = walk(join(ROOT, "standards"));
ok("scan: at least one real judge-validity gold set exists", manifests.length > 0, "expected a standards/*/judge-validity-gold.json");
let firstBad = "";
for (const f of manifests) {
  try {
    const { errors } = validateGoldSet(JSON.parse(readFileSync(f, "utf8")));
    if (errors.length && !firstBad) firstBad = `${f.slice(ROOT.length + 1)}: ${errors.join("; ")}`;
  } catch (err) {
    if (!firstBad) firstBad = `${f.slice(ROOT.length + 1)}: ${err.message}`;
  }
}
ok("scan: every real judge-validity gold set clears its threshold", firstBad === "", firstBad);

for (const f of ["validate.mjs", "README.md"]) ok(`file present: ${f}`, existsSync(join(__dirname, f)));

const failed = checks.filter((c) => !c.pass);
for (const c of checks) if (!c.pass) console.log(`  FAIL ${c.name}${c.detail ? `  [${c.detail}]` : ""}`);
console.log(`judge-validity: ${checks.length - failed.length}/${checks.length} selftest checks passed`);
process.exit(failed.length ? 1 : 0);
