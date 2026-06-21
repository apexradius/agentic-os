#!/usr/bin/env node

/**
 * apex-seo-mcp — SEO analysis MCP server.
 * Pure analysis engine: accepts HTML as input, returns structured JSON findings.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  UnifiedErrorHandler,
  registerHealthTool,
  log,
  EXIT_CODES,
} from '@framework/mcp-shared';
import { registerTechnicalTools } from './tools/technical.js';
import { registerContentTools } from './tools/content.js';
import { registerSchemaTools } from './tools/schema.js';
import { registerImageTools } from './tools/images.js';
import { registerAeoTools } from './tools/aeo.js';
import { registerSitemapTools } from './tools/sitemap.js';
import { registerLocalTools } from './tools/local.js';
import { registerGeneratorTools } from './tools/generators.js';
import { registerPerformanceTools } from './tools/performance.js';
import { registerAdvancedTools } from './tools/advanced.js';
import { registerDataForSEOTools } from './tools/dataforseo.js';
import { registerScoringTools } from './tools/scoring.js';
import { registerReportTools } from './tools/report.js';
import { registerGscTools } from './tools/gsc.js';
import { registerNextGenSeoTools } from './tools/nextgen.js';
import { createClient } from './services/dataforseo-client.js';

const MCP_NAME = 'apex-seo-mcp';
const MCP_VERSION = '1.1.0';

async function main(): Promise<void> {
  const errorHandler = new UnifiedErrorHandler({
    mcpName: MCP_NAME,
    retryOverrides: {
      dataforseo: { maxRetries: 2, initialDelayMs: 1000 },
    },
  });

  const serviceStatus: Record<string, boolean> = {
    analysis: true,
    dataforseo: false,
  };

  // DataForSEO client (optional)
  const dfClient = createClient();
  if (dfClient) {
    serviceStatus.dataforseo = true;
    log.info(MCP_NAME, 'dataforseo', 'startup', 'DataForSEO configured');
  } else {
    log.warn(MCP_NAME, 'dataforseo', 'startup', 'DataForSEO not configured — SERP/backlink tools disabled');
  }

  log.startup(MCP_NAME, MCP_VERSION, serviceStatus);

  const server = new McpServer({
    name: MCP_NAME,
    version: MCP_VERSION,
  });

  // Analysis tools (10)
  registerTechnicalTools(server);    // tools 1-2
  registerContentTools(server);      // tools 3-5
  registerSchemaTools(server);       // tool 6
  registerImageTools(server);        // tool 7
  registerAeoTools(server);          // tool 8
  registerSitemapTools(server);      // tool 9
  registerLocalTools(server);        // tool 10

  // Generator tools (3)
  registerGeneratorTools(server);    // tools 11-13

  // Performance tools (2)
  registerPerformanceTools(server);  // tools 14-15

  // DataForSEO tools (5)
  registerDataForSEOTools(server, dfClient); // tools 16-20

  // Advanced analysis (3)
  registerAdvancedTools(server);     // tools 21-23

  // Scoring & report (2)
  registerScoringTools(server);      // tool 24
  registerReportTools(server);       // tool 25

  // Google Search Console (migrated from social)
  registerGscTools(server);

  // Apex next-gen SEO tools
  registerNextGenSeoTools(server);

  // System health check
  registerHealthTool(server, {
    mcpName: MCP_NAME,
    version: MCP_VERSION,
    errorHandler,
    checks: {
      analysis: async () => null, // Always available
      dataforseo: async () => {
        return null;
      },
    },
  });

  process.on('SIGINT', () => process.exit(EXIT_CODES.SUCCESS));
  process.on('SIGTERM', () => process.exit(EXIT_CODES.SUCCESS));
  process.on('uncaughtException', (err) => {
    log.error(MCP_NAME, 'system', 'uncaught_exception', err.message);
  });
  process.on('unhandledRejection', (reason) => {
    log.error(MCP_NAME, 'system', 'unhandled_rejection', reason instanceof Error ? reason.message : String(reason));
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.ready(MCP_NAME, 46, serviceStatus);
}

main().catch((err) => {
  log.error(MCP_NAME, 'system', 'fatal', err instanceof Error ? err.message : String(err));
  process.exit(EXIT_CODES.FATAL_CONFIG_ERROR);
});
