#!/usr/bin/env node
// gate.mjs — the deterministic, safer-by-default tool gate.
//
//   node gate.mjs [--json] <file.jsonl>...        scan tool calls from JSONL fixture(s)
//   echo '<tool-call json>' | node gate.mjs -      scan one tool call from stdin
//
// Inspects each tool call against the machine-checkable subset of
// framework/doctrine/standards/tool-gate.md and decides allow / ask / deny. Exits non-zero
// when any call is DENIED (a blocking finding). This is the no-LLM half of the safer-by-default
// DNA; the judgment half is the `security-reviewer` role. What it cannot prove deterministically
// (novel obfuscation, intent, "is this safe in context") it defers to that role — see README.md.

import { readFileSync } from "node:fs";

import { buildSurface, surfacesFromJsonl } from "./lib/parse.mjs";
import { isAllowlisted } from "./rules/_shared.mjs";
import { RULES } from "./rules/index.mjs";

/** Run every rule against one Surface → findings. */
export function scanSurface(surface) {
  const findings = [];
  for (const rule of RULES) {
    let hits;
    try {
      hits = rule.check(surface) || [];
    } catch (err) {
      hits = [{ evidence: `rule crashed: ${err.message}` }];
    }
    for (const h of hits) {
      findings.push({ rule: rule.id, title: rule.title, severity: rule.severity, category: rule.category, ref: rule.ref, evidence: h.evidence });
    }
  }
  return findings;
}

/**
 * Decide on one tool call. Returns { decision, reason, findings }.
 *   blocking finding present → "deny"
 *   allowlisted, no findings → "allow"
 *   otherwise (notes, or unrecognized) → "ask"
 */
export function decide(call) {
  const surface = buildSurface(call);
  const findings = scanSurface(surface);
  const blocking = findings.filter((f) => f.severity === "blocking");
  if (blocking.length) {
    return { decision: "deny", reason: blocking.map((f) => f.title).join("; "), findings, surface };
  }
  if (findings.length) {
    return { decision: "ask", reason: findings.map((f) => f.title).join("; "), findings, surface };
  }
  if (isAllowlisted(surface)) {
    return { decision: "allow", reason: "known read-only operation", findings, surface };
  }
  return { decision: "ask", reason: "not pre-cleared — approve before running", findings, surface };
}

const ICON = { deny: "✗", ask: "?", allow: "✓" };

function report(results) {
  for (const r of results) {
    const where = r.surface.tool + (r.surface.path ? ` ${r.surface.path}` : "");
    console.log(`\n${ICON[r.decision]} ${r.decision.toUpperCase()}  [${where}]  ${r.surface.command || r.surface.path || ""}`.trimEnd());
    if (r.reason) console.log(`    ${r.reason}`);
    for (const f of r.findings) console.log(`    [${f.rule}] ${f.evidence}  → ${f.title} (${f.ref})`);
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────
if (process.argv[1] && process.argv[1].endsWith("gate.mjs")) {
  const argv = process.argv.slice(2);
  const json = argv.includes("--json");
  const targets = argv.filter((a) => !a.startsWith("--"));

  if (!targets.length) {
    console.error("usage: gate.mjs [--json] <file.jsonl>... | echo '<json>' | gate.mjs -");
    process.exit(2);
  }

  const surfaces = [];
  for (const t of targets) {
    const raw = t === "-" ? readFileSync(0, "utf8") : readFileSync(t, "utf8");
    // A single JSON object on stdin, or JSONL from a file.
    const trimmed = raw.trim();
    if (trimmed.startsWith("{")) surfaces.push(buildSurface(JSON.parse(trimmed)));
    else surfaces.push(...surfacesFromJsonl(raw));
  }

  const results = surfaces.map((s) => decide(s.raw));
  if (json) {
    console.log(JSON.stringify(results.map((r) => ({ decision: r.decision, reason: r.reason, findings: r.findings })), null, 2));
  } else {
    const tally = results.reduce((a, r) => ((a[r.decision] = (a[r.decision] || 0) + 1), a), {});
    console.log(`tool-gate: ${results.length} call(s) — ${tally.allow || 0} allow, ${tally.ask || 0} ask, ${tally.deny || 0} deny`);
    report(results);
  }

  process.exit(results.some((r) => r.decision === "deny") ? 1 : 0);
}
