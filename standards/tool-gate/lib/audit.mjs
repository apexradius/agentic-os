#!/usr/bin/env node

// lib/audit.mjs — opt-in, append-only NDJSON record of tool-gate decisions.
//
// Records THAT a decision happened — the tool, the verdict, which rules fired, and a hash of the
// reason — and nothing more. The raw command, file content, path, and reason text never reach the
// log. This honors framework/doctrine/standards/data-handling.md: the trail proves the gate acted
// without preserving the secret-bearing payload it acted on, and it is the concrete `gate_decisions`
// stream framework/doctrine/standards/observability.md names.
//
// Two properties keep it a safety net, never a liability:
//   • OPT-IN  — does nothing unless a log path is configured (TOOLGATE_AUDIT_LOG).
//   • FAIL-OPEN — a write error is swallowed; auditing must never wedge the gate it observes.
//
//   node audit.mjs <logfile> [--denied] [--since <iso>]   read back the trail

import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync } from 'node:fs';

/** sha256/12 of the reason — enough to correlate identical reasons, reveals nothing of the call. */
export function reasonHash(reason) {
  return createHash('sha256')
    .update(String(reason ?? ''))
    .digest('hex')
    .slice(0, 12);
}

/** Build the redacted record for one decision. Pure — no I/O, trivially assertable. */
export function buildRecord(result, now) {
  return {
    ts: (now ?? new Date()).toISOString(),
    tool: String(result?.surface?.tool ?? result?.tool ?? ''),
    decision: String(result?.decision ?? ''),
    rules: (result?.findings ?? []).map((f) => f.rule),
    reason_hash: reasonHash(result?.reason),
  };
}

/**
 * Append one decision to the audit log, if configured. Returns the record written, or null when
 * auditing is off (no path) or the write failed (fail-open — never throws).
 */
export function auditDecision(result, { logPath = process.env.TOOLGATE_AUDIT_LOG, now } = {}) {
  if (!logPath) return null;
  try {
    const record = buildRecord(result, now);
    appendFileSync(logPath, JSON.stringify(record) + '\n');
    return record;
  } catch {
    return null; // fail-open: a logging fault must not block the call the gate already decided
  }
}

// ── CLI: read the trail ──────────────────────────────────────────────────────
if (process.argv[1] && process.argv[1].endsWith('audit.mjs')) {
  const argv = process.argv.slice(2);
  const denied = argv.includes('--denied');
  const sinceIdx = argv.indexOf('--since');
  const since = sinceIdx >= 0 ? argv[sinceIdx + 1] : null;
  const file = argv.find((a) => !a.startsWith('--') && a !== since);

  if (!file) {
    console.error('usage: audit.mjs <logfile> [--denied] [--since <iso>]');
    process.exit(2);
  }
  let raw;
  try {
    raw = readFileSync(file, 'utf8');
  } catch (err) {
    console.error(`cannot read ${file}: ${err.message}`);
    process.exit(2);
  }
  const recs = raw
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  const out = recs.filter((r) => (!denied || r.decision === 'deny') && (!since || r.ts >= since));
  for (const r of out) {
    console.log(
      `${r.ts}  ${String(r.decision).toUpperCase().padEnd(5)} ${String(r.tool).padEnd(8)} [${(r.rules || []).join(',')}] ${r.reason_hash}`,
    );
  }
  const tally = out.reduce((a, r) => ((a[r.decision] = (a[r.decision] || 0) + 1), a), {});
  console.error(
    `${out.length} record(s)${denied ? ' (denied only)' : ''}${since ? ` since ${since}` : ''} — ${tally.deny || 0} deny, ${tally.ask || 0} ask, ${tally.allow || 0} allow`,
  );
  process.exit(0);
}
