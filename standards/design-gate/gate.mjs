#!/usr/bin/env node
// gate.mjs — the deterministic design anti-pattern gate.
//
//   node gate.mjs [--register operational|marketing] [--json] [--strict] <file|dir>...
//
// Scans CSS / HTML / JSX-TSX surfaces against the machine-checkable subset of
// framework/doctrine/standards/design.md and exits non-zero on any BLOCKING finding
// (or any finding with --strict). This is the no-LLM half of the two-layer taste DNA;
// the judgment half is the `design-critic` role. What this gate cannot prove
// deterministically (imagery quality, register intent, required-states completeness) it
// defers to that role — see README.md.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { buildSurface } from "./lib/surface.mjs";
import { RULES } from "./rules/index.mjs";

const SCANNABLE = /\.(css|scss|less|sass|html|htm|vue|svelte|jsx|tsx)$/i;

/** Run every applicable rule against one prepared Surface. */
export function scanSurface(surface) {
  const findings = [];
  const skippedRegisterRules = [];
  for (const rule of RULES) {
    if (rule.register !== "any") {
      if (!surface.register) { skippedRegisterRules.push(rule.id); continue; }
      if (surface.register !== rule.register) continue;
    }
    let hits;
    try {
      hits = rule.check(surface) || [];
    } catch (err) {
      hits = [{ line: 0, evidence: `rule crashed: ${err.message}` }];
    }
    for (const h of hits) {
      findings.push({ rule: rule.id, title: rule.title, severity: rule.severity, ref: rule.ref, file: surface.file, line: h.line, evidence: h.evidence });
    }
  }
  return { findings, skippedRegisterRules: [...new Set(skippedRegisterRules)] };
}

/** Convenience: scan raw text (used by the selftest and any embedding tool). */
export function scanText(file, content, opts = {}) {
  return scanSurface(buildSurface(file, content, opts));
}

function collectFiles(target) {
  if (!existsSync(target)) return [];
  const st = statSync(target);
  if (st.isFile()) return [target];
  const out = [];
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const p = join(target, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(p));
    else if (SCANNABLE.test(entry.name)) out.push(p);
  }
  return out;
}

function report(allFindings, { register, skipped }) {
  const blocking = allFindings.filter((f) => f.severity === "blocking");
  const notes = allFindings.filter((f) => f.severity === "note");
  const print = (f) => {
    const where = f.line ? `${f.file}:${f.line}` : f.file;
    console.log(`  [${f.rule}] ${where}`);
    console.log(`    ${f.evidence}`);
    console.log(`    → ${f.title} (${f.ref})`);
  };
  if (blocking.length) {
    console.log(`\n✗ ${blocking.length} blocking finding${blocking.length === 1 ? "" : "s"}`);
    blocking.forEach(print);
  }
  if (notes.length) {
    console.log(`\n! ${notes.length} note${notes.length === 1 ? "" : "s"} (non-blocking)`);
    notes.forEach(print);
  }
  if (!blocking.length && !notes.length) console.log("\n✓ clean — no design anti-patterns found");
  if (!register && skipped.length) {
    console.log(`\nℹ ${skipped.length} register-specific rule(s) skipped (${skipped.join(", ")}).`);
    console.log("  Pass --register operational|marketing to enable them.");
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────
if (process.argv[1] && process.argv[1].endsWith("gate.mjs")) {
  const argv = process.argv.slice(2);
  const flags = new Set(argv.filter((a) => a.startsWith("--") && !a.includes("=")));
  let register = null;
  const ri = argv.indexOf("--register");
  if (ri !== -1 && argv[ri + 1]) register = argv[ri + 1];
  const targets = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--register");

  if (!targets.length) {
    console.error("usage: gate.mjs [--register operational|marketing] [--json] [--strict] <file|dir>...");
    process.exit(2);
  }
  if (register && register !== "operational" && register !== "marketing") {
    console.error(`gate.mjs: --register must be 'operational' or 'marketing', got '${register}'`);
    process.exit(2);
  }

  const files = [...new Set(targets.flatMap(collectFiles))].sort();
  const all = [];
  const skippedAll = new Set();
  for (const f of files) {
    const { findings, skippedRegisterRules } = scanText(f, readFileSync(f, "utf8"), { register });
    all.push(...findings);
    skippedRegisterRules.forEach((r) => skippedAll.add(r));
  }

  if (flags.has("--json")) {
    console.log(JSON.stringify({ files: files.length, register, findings: all }, null, 2));
  } else {
    console.log(`design-gate: scanned ${files.length} file${files.length === 1 ? "" : "s"}${register ? ` (register: ${register})` : ""}`);
    report(all, { register, skipped: [...skippedAll] });
  }

  const blocking = all.filter((f) => f.severity === "blocking").length;
  const notes = all.filter((f) => f.severity === "note").length;
  const fail = blocking > 0 || (flags.has("--strict") && notes > 0);
  process.exit(fail ? 1 : 0);
}
