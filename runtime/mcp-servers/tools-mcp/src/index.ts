#!/usr/bin/env node

/**
 * apex-tools-mcp — Utility tools MCP
 *
 * Services:
 *   - image (native, sharp) — blur, crop, resize, rotate, change_color, fill,
 *     overlay, get_metainfo (+ 8 stub tools that explicitly return "not implemented"
 *     for the removed ML-heavy imagesorcery ops)
 *   - @21st-dev/magic (proxy, opt-in) — UI component generation, only registered
 *     when APEX_TOOLS_ENABLE_21ST_MAGIC=true AND TWENTYFIRST_MAGIC_API_KEY is set
 *
 * Changed 2026-04-16: Removed imagesorcery-mcp proxy entirely (1.2GB Python venv
 * with PyTorch/OpenCV/YOLO/CLIP). Image ops sharp can handle are now native;
 * ML-heavy ops (detect/find/ocr/draw_*) return not_implemented errors.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import {
  UnifiedErrorHandler,
  proxyChildMcp,
  registerHealthTool,
  log,
  EXIT_CODES,
  type ProxyTarget,
} from '@framework/mcp-shared';

import { registerImageTools } from './services/image.js';

const MCP_NAME = 'apex-tools-mcp';
const MCP_VERSION = '1.1.1';
const HOME_DIR = process.env['HOME'] || homedir();

function resolveTwentyFirstTarget(apiKey: string): ProxyTarget {
  const directBin =
    process.env['TWENTYFIRST_MAGIC_BIN'] ??
    `${HOME_DIR}/.mcp/stdio-local/node_modules/@21st-dev/magic/dist/index.js`;

  if (existsSync(directBin)) {
    return {
      name: '21st-dev',
      command: 'node',
      args: [directBin],
      env: { API_KEY: apiKey },
    };
  }

  return {
    name: '21st-dev',
    command: 'npx',
    args: ['-y', '@21st-dev/magic@latest'],
    env: { API_KEY: apiKey },
  };
}

function is21stMagicEnabled(): boolean {
  const flag = process.env['APEX_TOOLS_ENABLE_21ST_MAGIC'];
  if (!flag) return false;
  return ['1', 'true', 'yes', 'on'].includes(flag.toLowerCase());
}

async function main(): Promise<void> {
  const errorHandler = new UnifiedErrorHandler({ mcpName: MCP_NAME });

  const serviceStatus: Record<string, boolean> = {
    image: false,
    '21st-dev': false,
  };
  const twentyFirstEnabled = is21stMagicEnabled();

  const server = new McpServer({ name: MCP_NAME, version: MCP_VERSION });
  let totalTools = 0;

  // 1. Native image tools (sharp)
  const imgCount = registerImageTools(server);
  serviceStatus.image = imgCount > 0;
  totalTools += imgCount;

  // 3. Optional: @21st-dev/magic proxy — only when explicitly opted in
  if (twentyFirstEnabled) {
    const apiKey = process.env['TWENTYFIRST_MAGIC_API_KEY'] ?? '';
    if (apiKey) {
      const twentyFirstTarget = resolveTwentyFirstTarget(apiKey);
      const devCount = await proxyChildMcp(server, twentyFirstTarget, MCP_NAME);
      serviceStatus['21st-dev'] = devCount > 0;
      totalTools += devCount;
    } else {
      log.warn(
        MCP_NAME,
        '21st-dev',
        'startup',
        'APEX_TOOLS_ENABLE_21ST_MAGIC is set but TWENTYFIRST_MAGIC_API_KEY is missing — 21st-dev tools unavailable',
      );
    }
  } else {
    log.info(
      MCP_NAME,
      '21st-dev',
      'startup',
      '21st-dev/magic disabled (set APEX_TOOLS_ENABLE_21ST_MAGIC=true to enable)',
    );
  }

  // Health check
  registerHealthTool(server, {
    mcpName: MCP_NAME,
    version: MCP_VERSION,
    errorHandler,
    checks: {
      image: async () => (serviceStatus.image ? null : 'Image tools failed to register'),
      '21st-dev': async () =>
        !twentyFirstEnabled || serviceStatus['21st-dev']
          ? null
          : 'Enabled but child process/API key unavailable',
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
