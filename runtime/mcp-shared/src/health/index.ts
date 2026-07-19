/**
 * Health check tool registration helper.
 *
 * Every Apex MCP exposes a `system_health` tool that reports:
 * - Overall status (operational / degraded / down)
 * - Per-service health with last check timestamp
 * - Circuit breaker states
 * - Resource usage (memory, uptime)
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { UnifiedErrorHandler } from '../errors/handler.js';

export interface ServiceHealth {
  ok: boolean;
  error?: string;
  lastCheck: string;
}

export interface HealthReport {
  status: 'operational' | 'degraded' | 'down';
  mcp: string;
  version: string;
  services: Record<string, ServiceHealth>;
  circuitBreakers: Record<string, { state: string }>;
  uptime_seconds: number;
  memory_usage_mb: number;
}

export interface HealthCheckOptions {
  mcpName: string;
  version: string;
  errorHandler: UnifiedErrorHandler;
  /** Functions that check each service's health. Return null if healthy, error string if not. */
  checks: Record<string, () => Promise<string | null>>;
}

const startTime = Date.now();

/**
 * Register the `system_health` tool on an MCP server.
 */
export function registerHealthTool(server: McpServer, opts: HealthCheckOptions): void {
  server.tool('system_health', `Check health of all ${opts.mcpName} services`, {}, async () => {
    const services: Record<string, ServiceHealth> = {};
    const now = new Date().toISOString();

    // Run all health checks in parallel
    const entries = Object.entries(opts.checks);
    const results = await Promise.allSettled(entries.map(([, checkFn]) => checkFn()));

    let healthyCount = 0;
    for (let i = 0; i < entries.length; i++) {
      const [name] = entries[i]!;
      const result = results[i]!;

      if (result.status === 'fulfilled') {
        const error = result.value;
        services[name] = { ok: error === null, error: error ?? undefined, lastCheck: now };
        if (error === null) healthyCount++;
      } else {
        services[name] = {
          ok: false,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          lastCheck: now,
        };
      }
    }

    const totalServices = entries.length;
    let status: HealthReport['status'];
    if (healthyCount === totalServices) status = 'operational';
    else if (healthyCount === 0) status = 'down';
    else status = 'degraded';

    const report: HealthReport = {
      status,
      mcp: opts.mcpName,
      version: opts.version,
      services,
      circuitBreakers: opts.errorHandler.getCircuitStates(),
      uptime_seconds: Math.round((Date.now() - startTime) / 1000),
      memory_usage_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    };

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(report, null, 2),
        },
      ],
    };
  });
}
