#!/usr/bin/env node
// journal.mjs — the durability step-journal: an append-only NDJSON replay log that lets a killed
// loop resume without re-firing a side effect it already completed. Mirrors observability/sink.mjs:
// OPT-IN (writes only when a journal path is configured), FAIL-OPEN (a journal error never wedges
// the step it protects), append-only one-object-per-line. The store is instance-owned and
// instance-named — the framework hardcodes no path. See framework/loop/durability.md.

import { appendFileSync, readFileSync } from "node:fs";

/** Build a typed journal entry. `now` (a Date) is injected so the builder is pure/deterministic. */
export function buildEntry(input = {}, now) {
  const e = {
    ts: (now ?? new Date()).toISOString(),
    task_id: String(input.task_id ?? ""),
    step: String(input.step ?? ""),
  };
  if (input.attempt != null) e.attempt = Number(input.attempt);
  if (input.idempotency_key) e.idempotency_key = String(input.idempotency_key);
  if (input.result) e.result = String(input.result);
  if (input.evidence) e.evidence = String(input.evidence);
  if (input.metadata != null) e.metadata = input.metadata;
  return e;
}

/** Append one entry to the configured journal. Returns the entry, or null when opted-out/failed. */
export function appendJournalEntry(input, { logPath = process.env.DURABILITY_JOURNAL, now } = {}) {
  if (!logPath) return null;                                  // OPT-IN: no path → no-op
  try {
    const e = buildEntry(input, now);
    appendFileSync(logPath, JSON.stringify(e) + "\n");        // one JSON object per line
    return e;
  } catch {
    return null;                                              // FAIL-OPEN: never throw
  }
}

/** Parse a journal file into entries (missing/garbled lines are skipped, never thrown). */
export function readJournal(logPath) {
  let raw;
  try { raw = readFileSync(logPath, "utf8"); } catch { return []; }
  return raw.split("\n").filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

/**
 * The replay rule: return the latest journaled entry for (task_id, step[, idempotency_key]) whose
 * result marks the step already done — so the caller can skip re-running a recorded side effect and
 * reuse the result. Returns the entry, or null when the step has not completed (must run it).
 */
export function replayLookup(entries, { task_id, step, idempotency_key, okResults = ["ok", "pass"] } = {}) {
  const matches = entries.filter((e) =>
    e.task_id === task_id &&
    e.step === step &&
    (idempotency_key ? e.idempotency_key === idempotency_key : true) &&
    okResults.includes(e.result));
  return matches.length ? matches[matches.length - 1] : null;
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────
//   append: node journal.mjs --append --file <f> --task <id> --step <s> [--attempt n] [--key k]
//                            [--result r] [--evidence e]
//   replay: node journal.mjs --replay --file <f> --task <id> --step <s> [--key k]   (prints entry|"")
//   list:   node journal.mjs <f> [--task <id>]
if (process.argv[1] && process.argv[1].endsWith("journal.mjs")) {
  const argv = process.argv.slice(2);
  const flag = (name) => { const i = argv.indexOf(name); return i !== -1 && argv[i + 1] ? argv[i + 1] : null; };
  const has = (name) => argv.includes(name);
  const file = flag("--file") || argv.find((a, i) => !a.startsWith("--") && argv[i - 1] !== "--task" &&
    argv[i - 1] !== "--step" && argv[i - 1] !== "--attempt" && argv[i - 1] !== "--key" &&
    argv[i - 1] !== "--result" && argv[i - 1] !== "--evidence" && argv[i - 1] !== "--file");

  if (has("--append")) {
    if (!file) { console.error("journal: --append needs --file"); process.exit(2); }
    const e = appendJournalEntry({
      task_id: flag("--task"), step: flag("--step"),
      attempt: flag("--attempt") != null ? Number(flag("--attempt")) : null,
      idempotency_key: flag("--key"), result: flag("--result"), evidence: flag("--evidence"),
    }, { logPath: file });
    process.exit(e ? 0 : 0); // FAIL-OPEN: never fail the caller on a journal write
  }

  if (has("--replay")) {
    if (!file) { console.error("journal: --replay needs --file"); process.exit(2); }
    const hit = replayLookup(readJournal(file), { task_id: flag("--task"), step: flag("--step"), idempotency_key: flag("--key") });
    if (hit) process.stdout.write(JSON.stringify(hit) + "\n");
    process.exit(0);
  }

  // list mode
  if (!file) { console.error("usage: journal.mjs <file> [--task <id>] | --append … | --replay …"); process.exit(2); }
  const task = flag("--task");
  for (const e of readJournal(file).filter((e) => (task ? e.task_id === task : true))) {
    console.log(`${e.ts}  ${String(e.step).padEnd(9)} ${String(e.result ?? "").padEnd(6)} ${e.task_id}${e.attempt ? ` a${e.attempt}` : ""}${e.idempotency_key ? ` ${e.idempotency_key}` : ""}`);
  }
  process.exit(0);
}
