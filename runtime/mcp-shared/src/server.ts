import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { UnifiedErrorHandler, type ErrorHandlerOptions } from './errors/handler.js';
import { registerHealthTool } from './health/index.js';

export interface ApexServerOptions extends ErrorHandlerOptions {
  version: string;
  /** Service health checks: return null if OK, error string if not. */
  healthChecks?: Record<string, () => Promise<string | null>>;
}

/**
 * Factory to create a standardized Apex MCP server with:
 * - Built-in health check tool (`system_health`)
 * - Unified error handler with circuit breakers
 * - Consistent versioning and naming
 */
export function createApexServer(opts: ApexServerOptions) {
  const server = new McpServer({
    name: opts.mcpName,
    version: opts.version,
  });

  const errorHandler = new UnifiedErrorHandler({
    ...opts
  });

  if (opts.healthChecks) {
    registerHealthTool(server, {
      mcpName: opts.mcpName,
      version: opts.version,
      errorHandler,
      checks: opts.healthChecks,
    });
  }

  return {
    server,
    errorHandler,
  };
}
