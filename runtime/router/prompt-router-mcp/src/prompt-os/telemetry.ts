/**
 * Apex Prompt OS — Phase 4 routing decision log.
 *
 * GATING: writes ONLY when process.env.APEX_PROMPT_TELEMETRY is truthy.
 * Default (unset) → no-op; zero bytes written, zero overhead on the routing path.
 *
 * PATH: process.env.APEX_PROMPT_TELEMETRY_PATH if set, else
 *       <package-root>/docs/routing/decisions.jsonl (relative to this file).
 *       Parent directory is created if missing.
 *
 * BEST-EFFORT: any write failure is caught and emitted to stderr only.
 * A telemetry failure MUST NEVER propagate into the routing path.
 *
 * FUTURE UPGRADE (deferred per a maintainer decision 2026-06-16):
 *   Replace / augment file writes with the omnibus telemetry MCP:
 *     mcp__apex-omnibus-mcp__telemetry__telemetry_log_action
 *   That requires a cross-process MCP call from the router server — not
 *   appropriate for the embedded stdio server context today. File-based log
 *   is the deliverable; Langfuse / omnibus telemetry hook is the upgrade path
 *   once an out-of-band telemetry sidecar is available.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Record shape
// ---------------------------------------------------------------------------

export type RoutingDecisionRecord = {
  /** ISO 8601 timestamp of the routing decision */
  ts: string;
  /** The input string (user_goal + session_summary concatenated, or empty) */
  input: string;
  /** The selected prompt's slug and name, or null on fallback/error */
  selected: { slug: string; name: string } | null;
  /** Confidence score 0-100, or null if not available */
  confidence: number | null;
  /** Margin between top and runner-up score, or null if not available */
  margin: number | null;
  /** Runner-up prompt name, or null */
  runner_up: string | null;
  /** Whether the selection was a fallback (no confident match) */
  fallback: boolean;
  /** Library mode at time of decision */
  mode: 'monolith' | 'structured';
};

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

function resolveLogPath(): string {
  if (process.env['APEX_PROMPT_TELEMETRY_PATH']) {
    return process.env['APEX_PROMPT_TELEMETRY_PATH'];
  }
  // Resolve relative to this module: src/prompt-os/ → package root → docs/routing/
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', '..', 'docs', 'routing', 'decisions.jsonl');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Append one JSON line to the routing decision log.
 *
 * No-op unless APEX_PROMPT_TELEMETRY is set to a truthy value.
 * Never throws — all I/O errors are swallowed after logging to stderr.
 */
export async function logRoutingDecision(
  record: RoutingDecisionRecord,
  opts?: { logPath?: string },
): Promise<void> {
  const enabled = process.env['APEX_PROMPT_TELEMETRY'];
  if (!enabled || enabled === '0' || enabled === 'false') return;

  const logPath = opts?.logPath ?? resolveLogPath();
  const line = JSON.stringify(record) + '\n';

  try {
    await fs.mkdir(path.dirname(logPath), { recursive: true });
    await fs.appendFile(logPath, line, 'utf8');
  } catch (error) {
    // Best-effort: write to stderr only (never stdout — that is the MCP channel)
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[apex-prompt-router-mcp] telemetry write failed (${logPath}): ${message}\n`);
  }
}
