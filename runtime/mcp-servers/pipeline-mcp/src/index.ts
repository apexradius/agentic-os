#!/usr/bin/env node

import { homedir } from 'node:os';
import { join } from 'node:path';
import { EXIT_CODES, log, registerHealthTool, UnifiedErrorHandler } from '@framework/mcp-shared';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Ledger } from './ledger.js';
import { registerStageTools } from './tools/stages.js';

const MCP_NAME = 'pipeline-mcp';
const MCP_VERSION = '0.1.0';

function ledgerPath(argv: string[]): string {
  const i = argv.indexOf('--ledger');
  if (i >= 0 && argv[i + 1]) return argv[i + 1]!;
  if (process.env['PIPELINE_LEDGER']) return process.env['PIPELINE_LEDGER']!;
  return join(homedir(), '.local', 'state', 'pipeline-mcp', 'completions.jsonl');
}

async function main(): Promise<void> {
  const ledger = new Ledger(ledgerPath(process.argv.slice(2)));

  const errorHandler = new UnifiedErrorHandler({ mcpName: MCP_NAME });

  log.startup(MCP_NAME, MCP_VERSION, { ledger: true });

  const server = new McpServer({ name: MCP_NAME, version: MCP_VERSION });

  registerStageTools(server, ledger);

  registerHealthTool(server, {
    mcpName: MCP_NAME,
    version: MCP_VERSION,
    errorHandler,
    checks: {
      ledger: async () => {
        try {
          await ledger.readAll();
          return null;
        } catch (e) {
          return e instanceof Error ? e.message : String(e);
        }
      },
    },
  });

  process.on('SIGINT', () => process.exit(EXIT_CODES.SUCCESS));
  process.on('SIGTERM', () => process.exit(EXIT_CODES.SUCCESS));
  process.on('uncaughtException', (err) => {
    log.error(MCP_NAME, 'system', 'uncaught_exception', err.message);
  });
  process.on('unhandledRejection', (reason) => {
    log.error(
      MCP_NAME,
      'system',
      'unhandled_rejection',
      reason instanceof Error ? reason.message : String(reason),
    );
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.ready(MCP_NAME, 3, { ledger: true });
}

main().catch((err) => {
  log.error(MCP_NAME, 'system', 'fatal', err instanceof Error ? err.message : String(err));
  process.exit(EXIT_CODES.FATAL_CONFIG_ERROR);
});
