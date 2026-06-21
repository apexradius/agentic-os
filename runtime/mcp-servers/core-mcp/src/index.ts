#!/usr/bin/env node

/**
 * apex-core-mcp — Core infrastructure MCP
 *
 * Consolidates:
 *   - context7 (2 tools, proxy via child process)
 *   - memory (9 tools, proxy via child process)
 *   - 1password (5 tools, legacy opt-in via APEX_ENABLE_1PASSWORD_TOOLS=1)
 *
 * Total: ~16 tools + system_health
 */

import { createRequire } from 'node:module';
import { dirname, resolve as pathResolve } from 'node:path';
import { homedir } from 'node:os';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { existsSync } from 'node:fs';
import {
  UnifiedErrorHandler,
  proxyChildMcp,
  registerHealthTool,
  log,
  EXIT_CODES,
  type ProxyTarget,
} from '@framework/mcp-shared';
import { registerOnePasswordTools, isOpAvailable } from './tools/onepassword.js';
import { registerSearchTools, isExaAvailable } from './tools/search.js';

const MCP_NAME = 'apex-core-mcp';
const MCP_VERSION = '1.0.4';
const HOME_DIR = process.env['HOME'] || homedir();

function resolveContext7Target(): ProxyTarget {
  const directBin = process.env['CONTEXT7_MCP_BIN']
    ?? `${HOME_DIR}/.mcp/context7/node_modules/@upstash/context7-mcp/dist/index.js`;

  if (existsSync(directBin)) {
    return {
      name: 'context7',
      command: 'node',
      args: [directBin],
    };
  }

  // Resolve the @upstash/context7-mcp entry via node_modules lookup.
  // Package has no "main"/"exports", only "bin", so resolve via package.json
  // and construct the bin path relative to the package root.
  const require = createRequire(import.meta.url);
  const pkgJsonPath = require.resolve('@upstash/context7-mcp/package.json');
  const context7Entry = pathResolve(dirname(pkgJsonPath), 'dist/index.js');

  return {
    name: 'context7',
    command: 'node',
    args: [context7Entry],
  };
}

function resolveMemoryTarget(): ProxyTarget {
  const directBin = process.env['MEMORY_MCP_BIN']
    ?? `${HOME_DIR}/.mcp/stdio-local/node_modules/@modelcontextprotocol/server-memory/dist/index.js`;

  if (existsSync(directBin)) {
    return {
      name: 'memory',
      command: 'node',
      args: [directBin],
    };
  }

  // Resolve the @modelcontextprotocol/server-memory entry via node_modules lookup.
  // Package has no "main"/"exports", only "bin", so resolve via package.json
  // and construct the bin path relative to the package root.
  const require = createRequire(import.meta.url);
  const pkgJsonPath = require.resolve('@modelcontextprotocol/server-memory/package.json');
  const memoryEntry = pathResolve(dirname(pkgJsonPath), 'dist/index.js');

  return {
    name: 'memory',
    command: 'node',
    args: [memoryEntry],
  };
}

function isOnePasswordToolsEnabled(): boolean {
  return process.env['APEX_ENABLE_1PASSWORD_TOOLS'] === '1';
}

async function main(): Promise<void> {
  const errorHandler = new UnifiedErrorHandler({
    mcpName: MCP_NAME,
    retryOverrides: {
      proxy: { maxRetries: 1, initialDelayMs: 500 },
    },
  });

  const serviceStatus: Record<string, boolean> = {
    context7: false,
    memory: false,
    '1password': false,
    exa: false,
  };

  const server = new McpServer({ name: MCP_NAME, version: MCP_VERSION });
  let totalTools = 0;

  // 1. Proxy context7 (2 tools)
  const context7Target = resolveContext7Target();
  const ctx7Count = await proxyChildMcp(server, context7Target, MCP_NAME);
  serviceStatus.context7 = ctx7Count > 0;
  totalTools += ctx7Count;

  // 2. Proxy memory (9 tools)
  const memoryTarget = resolveMemoryTarget();
  const memCount = await proxyChildMcp(server, memoryTarget, MCP_NAME);
  serviceStatus.memory = memCount > 0;
  totalTools += memCount;

  // 3. Native 1Password tools (legacy compatibility; disabled by default)
  const onePasswordToolsEnabled = isOnePasswordToolsEnabled();
  serviceStatus['1password'] = onePasswordToolsEnabled && isOpAvailable();
  if (serviceStatus['1password']) {
    registerOnePasswordTools(server);
    totalTools += 5;
  } else if (!onePasswordToolsEnabled) {
    log.info(
      MCP_NAME,
      '1password',
      'startup',
      '1Password tools disabled by default; set APEX_ENABLE_1PASSWORD_TOOLS=1 to opt in',
    );
  } else {
    log.warn(MCP_NAME, '1password', 'startup', '`op` CLI not found — 1Password tools unavailable');
  }

  // 4. Exa tools (5 tools)
  serviceStatus.exa = isExaAvailable();
  if (serviceStatus.exa) {
    registerSearchTools(server);
    totalTools += 5;
  } else {
    log.warn(MCP_NAME, 'exa', 'startup', 'EXA_API_KEY not set — Exa tools unavailable');
  }

  // Health check (always registered)
  registerHealthTool(server, {
    mcpName: MCP_NAME,
    version: MCP_VERSION,
    errorHandler,
    checks: {
      context7: async () => serviceStatus.context7 ? null : 'Child process failed to start',
      memory: async () => serviceStatus.memory ? null : 'Child process failed to start',
      '1password': async () => {
        if (!isOnePasswordToolsEnabled()) return null;
        if (!isOpAvailable()) return '`op` CLI not available';
        return null;
      },
      exa: async () => {
        if (!isExaAvailable()) return 'EXA_API_KEY not set';
        return null;
      },
    },
  });
  totalTools += 1;

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.ready(MCP_NAME, totalTools, serviceStatus);

  // Graceful shutdown
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
