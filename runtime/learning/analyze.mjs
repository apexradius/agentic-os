#!/usr/bin/env node
// analyze.mjs — the learning-loop analyzer: the impure entry that reads a run-record log and prints
// signals + a bounded list of review candidates. Mirrors observability/sink.mjs's CLI shape. It READS
// only — no write path, always exits success; its output feeds a human/Council retro (the learning
// standard). Lives under runtime/ — NOT discovered by `validate.mjs --all`; run it directly or in CI.

import { readFileSync } from "node:fs";
import { parseRunRecords, buildReport } from "./lib/analyze.mjs";

if (process.argv[1] && process.argv[1].endsWith("analyze.mjs")) {
  const argv = process.argv.slice(2);
  let file = null, asJson = false, top = 5, minFails = 2;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") asJson = true;
    else if (a === "--top") top = Number(argv[++i]);
    else if (a === "--min-fails") minFails = Number(argv[++i]);
    else if (!a.startsWith("--")) file = a;
  }
  if (!file) { console.error("usage: analyze.mjs <runrecord.ndjson> [--json] [--top N] [--min-fails K]"); process.exit(2); }

  let raw = "";
  try { raw = readFileSync(file, "utf8"); } catch { console.error(`analyze.mjs: cannot read ${file}`); process.exit(1); }

  const report = buildReport(parseRunRecords(raw), { now: new Date(), top, minFails });
  if (asJson) { console.log(JSON.stringify(report, null, 2)); process.exit(0); }
  printReport(report);
  process.exit(0); // a report, never a gate
}

function printReport(rep) {
  const w = rep.window;
  console.log(`learning report — ${w.total} run-record(s)${w.first_ts ? `  ${w.first_ts.slice(0, 10)}..${(w.last_ts ?? "").slice(0, 10)}` : ""}`);
  const s = rep.signals;
  group("recurring failures", s.recurring_failures.map((f) => `${f.slice}  ${f.fails}/${f.runs} fail (${Math.round(f.fail_rate * 100)}%)`));
  group("rework hotspots", s.rework_hotspots.map((h) => `${h.slice}  ${h.rework_runs}/${h.runs} runs >1 attempt (avg ${h.avg_attempts})`));
  group(`duration outliers (median ${s.duration_outliers.median})`, s.duration_outliers.items.map((o) => `${o.slice}/${o.task_id}  ${o.duration}`));
  group(`cost outliers (median ${s.cost_outliers.median})`, s.cost_outliers.items.map((o) => `${o.slice}/${o.task_id}  ${o.cost}`));
  group("gate skew", s.gate_skew.map((g) => `${g.rule}  always-${g.skewed} (${g.total})`));

  console.log(`\ncandidates for review (${rep.candidates.length}):`);
  if (!rep.candidates.length) console.log("  (none — not enough signal)");
  for (const c of rep.candidates) console.log(`  • [${c.kind}] ${c.subject}\n    ${c.rationale}`);
  console.log(`\n${rep.note}`);
}

function group(label, items) {
  if (!items.length) return;
  console.log(`\n${label} (${items.length}):`);
  for (const it of items) console.log(`  - ${it}`);
}
