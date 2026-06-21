#!/usr/bin/env node

/**
 * apex-canva-mcp — Canva Connect API MCP server.
 *
 * Services:
 *   - canva (native, REST Connect API v1) — design creation, brand-template autofill,
 *     export (PDF/PNG/JPG/GIF/PPTX/MP4), asset upload, folder + design listing.
 *     Gated on CANVA_CLIENT_ID + CANVA_CLIENT_SECRET; requires a one-time
 *     `apex-canva-login` to produce the refresh token.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  UnifiedErrorHandler,
  registerHealthTool,
  log,
  EXIT_CODES,
} from '@framework/mcp-shared';

import { registerCanvaTools, canvaHealth } from './services/canva.js';

const MCP_NAME = 'apex-canva-mcp';
const MCP_VERSION = '1.0.0';

async function main(): Promise<void> {
  const errorHandler = new UnifiedErrorHandler({ mcpName: MCP_NAME });

  const serviceStatus: Record<string, boolean> = { canva: false };

  const server = new McpServer({ name: MCP_NAME, version: MCP_VERSION });
  let totalTools = 0;

  const canvaCount = registerCanvaTools(server, errorHandler);
  serviceStatus.canva = canvaCount > 0;
  totalTools += canvaCount;

  registerHealthTool(server, {
    mcpName: MCP_NAME,
    version: MCP_VERSION,
    errorHandler,
    checks: {
      canva: async () => {
        if (!serviceStatus.canva) return 'Not available (missing CANVA_CLIENT_ID / CANVA_CLIENT_SECRET)';
        return canvaHealth();
      },
    },
  });
  totalTools += 1;

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.ready(MCP_NAME, totalTools, serviceStatus);

  const shutdown = () => {
    log.info(MCP_NAME, 'system', 'shutdown', 'Shutting down');
    process.exit(EXIT_CODES.SUCCESS);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  log.error(MCP_NAME, 'system', 'fatal', error instanceof Error ? error.message : String(error));
  process.exit(EXIT_CODES.FATAL_CONFIG_ERROR);
});
