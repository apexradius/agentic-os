#!/usr/bin/env node
// sink.mjs — the run-record sink: the impure entry that supplies the real clock + file. Mirrors
// standards/tool-gate/lib/audit.mjs exactly: OPT-IN (writes only when RUNRECORD_LOG is set),
// FAIL-OPEN (a write error is swallowed, never wedges the task it observes), append-only NDJSON.
// The store is instance-owned and instance-named (the env var) — the framework hardcodes no path.

import { appendFileSync, readFileSync } from "node:fs";
import { buildRunRecord } from "./lib/record.mjs";

/** Append one run-record to the configured sink. Returns the record, or null when opted-out/failed. */
export function appendRunRecord(input, { logPath = process.env.RUNRECORD_LOG, now } = {}) {
  if (!logPath) return null; // OPT-IN: no path → no-op
  try {
    const record = buildRunRecord(input, now);
    appendFileSync(logPath, JSON.stringify(record) + "\n"); // one JSON object per line
    return record;
  } catch {
    return null; // FAIL-OPEN: never throw
  }
}

// ── CLI read-back: node sink.mjs <logfile> [--task <id>] [--since <iso>] [--failed] ──
if (process.argv[1] && process.argv[1].endsWith("sink.mjs")) {
  const argv = process.argv.slice(2);
  let file = null, task = null, since = null, onlyFailed = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--task") task = argv[++i];
    else if (a === "--since") since = argv[++i];
    else if (a === "--failed") onlyFailed = true;
    else if (!a.startsWith("--")) file = a;
  }
  if (!file) { console.error("usage: sink.mjs <logfile> [--task <id>] [--since <iso>] [--failed]"); process.exit(2); }

  let raw = "";
  try { raw = readFileSync(file, "utf8"); } catch { console.error(`sink.mjs: cannot read ${file}`); process.exit(1); }

  const recs = raw.split("\n").filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean)
    .filter((r) => (task ? r.task_id === task : true))
    .filter((r) => (since ? r.ts >= since : true))
    .filter((r) => (onlyFailed ? r.verify?.result === "fail" : true));

  for (const r of recs) {
    const gates = r.gate_decisions?.length ? ` [${r.gate_decisions.length} gate]` : "";
    console.log(`${r.ts}  ${String(r.verify?.result ?? "?").padEnd(4)} ${String(r.task_id).padEnd(20)} ${r.slice}  a${r.attempts}${gates}`);
  }
  const fails = recs.filter((r) => r.verify?.result === "fail").length;
  console.error(`${recs.length} run-record(s) — ${recs.length - fails} pass, ${fails} fail`);
  process.exit(0);
}
