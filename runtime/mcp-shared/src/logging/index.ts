/**
 * JSON-structured logging for all Apex MCPs.
 *
 * All output goes to stderr (MCP protocol uses stdout for JSON-RPC).
 * Structured as JSON so logs can be parsed programmatically.
 */

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  mcp: string;
  service: string;
  op: string;
  msg: string;
  ts: string;
  [key: string]: unknown;
}

function emit(entry: LogEntry): void {
  console.error(JSON.stringify(entry));
}

export const log = {
  info(
    mcp: string,
    service: string,
    op: string,
    msg: string,
    extra?: Record<string, unknown>,
  ): void {
    emit({ level: 'info', mcp, service, op, msg, ts: new Date().toISOString(), ...extra });
  },

  warn(
    mcp: string,
    service: string,
    op: string,
    msg: string,
    extra?: Record<string, unknown>,
  ): void {
    emit({ level: 'warn', mcp, service, op, msg, ts: new Date().toISOString(), ...extra });
  },

  error(
    mcp: string,
    service: string,
    op: string,
    msg: string,
    extra?: Record<string, unknown>,
  ): void {
    emit({ level: 'error', mcp, service, op, msg, ts: new Date().toISOString(), ...extra });
  },

  debug(
    mcp: string,
    service: string,
    op: string,
    msg: string,
    extra?: Record<string, unknown>,
  ): void {
    if (process.env['APEX_MCP_DEBUG'] === '1') {
      emit({ level: 'debug', mcp, service, op, msg, ts: new Date().toISOString(), ...extra });
    }
  },

  /** Convenience: log MCP startup */
  startup(mcp: string, version: string, services: Record<string, boolean>): void {
    emit({
      level: 'info',
      mcp,
      service: 'system',
      op: 'startup',
      msg: `${mcp} v${version} starting`,
      ts: new Date().toISOString(),
      services,
    });
  },

  /** Convenience: log MCP ready state */
  ready(mcp: string, toolCount: number, services: Record<string, boolean>): void {
    const healthy = Object.values(services).filter(Boolean).length;
    const total = Object.values(services).length;
    emit({
      level: 'info',
      mcp,
      service: 'system',
      op: 'ready',
      msg: `${mcp} ready — ${toolCount} tools, ${healthy}/${total} services healthy`,
      ts: new Date().toISOString(),
      toolCount,
      services,
    });
  },
};
