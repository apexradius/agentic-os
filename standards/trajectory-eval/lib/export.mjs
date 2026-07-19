#!/usr/bin/env node
// lib/export.mjs — the ZONE-PURE exporter. Turns a set of spans-shaped rows into a trajectory
// document. It knows NOTHING about any host, deploy path, or store location: it reads either a
// local sqlite file you name, or a JSON array of rows on stdin. An instance that keeps its spans
// on a remote box writes a thin wrapper that fetches the rows and pipes them here — the wrapper
// owns the coupling, this file stays extractable to any spans-shaped sqlite.
//
//   node export.mjs --sqlite /path/os.db --trace <trace_id> [--model M] [--fingerprint F] [--prompt-file P]
//   <producer> | node export.mjs --stdin --trace <trace_id> [--model M] [--fingerprint F] [--prompt-file P]
//
// --prompt-file stamps provenance.prompt_version = sha256(frontmatter+body) of the dispatched
// agent's prompt file; a missing file leaves prompt_version null (never fabricated).
//
// Rows must carry the spans-table columns: trace_id, span_id, parent_span_id, operation, name,
// start_ts, end_ts, duration_ms, agent_id, agent_type, model, tool_name, tokens_in, tokens_out,
// finish_reason, self_report, attributes_json.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { SCHEMA_ID } from './trajectory.mjs';

const ROW_COLS = [
  'trace_id',
  'span_id',
  'parent_span_id',
  'operation',
  'name',
  'start_ts',
  'end_ts',
  'duration_ms',
  'agent_id',
  'agent_type',
  'model',
  'tool_name',
  'tokens_in',
  'tokens_out',
  'finish_reason',
  'self_report',
  'attributes_json',
];

/** Map one spans-table row → a trajectory span. attributes_json is parsed for the long tail. */
export function rowToSpan(r) {
  let attributes = {};
  try {
    attributes = JSON.parse(r.attributes_json || '{}');
  } catch {
    /* keep {} */
  }
  return {
    span_id: r.span_id,
    parent_span_id: r.parent_span_id ?? null,
    operation: r.operation,
    name: r.name ?? null,
    start_ts: r.start_ts ?? null,
    end_ts: r.end_ts ?? null,
    duration_ms: r.duration_ms ?? null,
    agent_id: r.agent_id ?? null,
    agent_type: r.agent_type ?? null,
    model: r.model ?? null,
    tool_name: r.tool_name ?? null,
    tokens_in: r.tokens_in ?? null,
    tokens_out: r.tokens_out ?? null,
    finish_reason: r.finish_reason ?? null,
    self_report: r.self_report ?? null,
    attributes,
  };
}

/** Build a trajectory document from rows (already filtered to one trace). Pure. */
export function exportFromRows(
  rows,
  { trace_id, model, agent_type, prompt_version = null, task_fingerprint },
) {
  const spans = rows
    .map(rowToSpan)
    .sort((a, b) => String(a.start_ts || '').localeCompare(String(b.start_ts || '')));
  const inferredModel = model || spans.find((s) => s.model)?.model || 'unknown';
  const inferredAgent = agent_type || spans.find((s) => s.agent_type)?.agent_type || null;
  return {
    schema: SCHEMA_ID,
    trace_id,
    recorded_at: new Date().toISOString(),
    provenance: {
      model: inferredModel,
      agent_type: inferredAgent,
      prompt_version,
      task_fingerprint: task_fingerprint || `trace:${trace_id}`,
    },
    spans,
  };
}

/** Fingerprint a prompt's full text (frontmatter + body) as an algorithm-tagged, short sha256.
 *  Short form (first 16 hex = 64 bits) is enough to pin a prompt version and stay readable; the
 *  `sha256:` prefix keeps it self-describing if the algorithm ever changes. Pure. */
export function promptFingerprint(content) {
  return (
    'sha256:' + createHash('sha256').update(String(content), 'utf8').digest('hex').slice(0, 16)
  );
}

/** Fingerprint the prompt file at `path`. Returns null when `path` is falsy or the file is absent
 *  — a missing prompt yields a null prompt_version, never a fabricated one. Reading a caller-named
 *  path keeps this zone-pure: the caller (an instance wrapper) owns WHERE agent prompts live; this
 *  only hashes what it is handed. */
export function promptFingerprintFromFile(path) {
  if (!path || !existsSync(path)) return null;
  return promptFingerprint(readFileSync(path, 'utf8'));
}

function shq(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

/** Read the rows for one trace from a LOCAL sqlite file (no remote knowledge). */
export function rowsFromSqlite(sqlitePath, traceId) {
  const sql = `SELECT ${ROW_COLS.join(', ')} FROM spans WHERE trace_id=${shq(traceId)} ORDER BY start_ts;`;
  const out = execFileSync('sqlite3', ['-json', sqlitePath, sql], {
    encoding: 'utf-8',
    maxBuffer: 128 * 1024 * 1024,
  }).trim();
  return out ? JSON.parse(out) : [];
}

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const trace = arg('--trace');
  if (!trace) {
    console.error(
      'usage: export.mjs --trace <id> (--sqlite <path> | --stdin) [--model M] [--fingerprint F] [--prompt-file P]',
    );
    process.exit(2);
  }
  const promptFile = arg('--prompt-file');
  const prompt_version = promptFingerprintFromFile(promptFile);
  if (promptFile && prompt_version === null)
    console.error(`export.mjs: prompt file not found: ${promptFile} — prompt_version stays null`);
  const meta = {
    trace_id: trace,
    model: arg('--model'),
    agent_type: arg('--agent-type'),
    prompt_version,
    task_fingerprint: arg('--fingerprint'),
  };
  let rows;
  if (process.argv.includes('--stdin')) {
    const raw = readFileSync(0, 'utf-8').trim();
    rows = raw ? JSON.parse(raw) : [];
  } else {
    const sqlitePath = arg('--sqlite');
    if (!sqlitePath) {
      console.error('export.mjs: pass --sqlite <path> or --stdin');
      process.exit(2);
    }
    rows = rowsFromSqlite(sqlitePath, trace);
  }
  if (!rows.length) {
    console.error(`export.mjs: no spans for trace ${trace}`);
    process.exit(1);
  }
  console.log(JSON.stringify(exportFromRows(rows, meta), null, 2));
}
