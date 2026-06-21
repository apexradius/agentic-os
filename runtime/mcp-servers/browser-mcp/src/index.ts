#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  UnifiedErrorHandler,
  registerHealthTool,
  log,
  EXIT_CODES,
} from "@framework/mcp-shared";
import { BrowserManager } from "./browser.js";
import { TabRegistry } from "./tabs.js";
import { registerCaptureTools } from "./tools/capture.js";
import { registerPointerTools } from "./tools/pointer.js";
import { registerEvaluateTools } from "./tools/evaluate.js";
import { registerInteractionTools } from "./tools/interaction.js";
import { registerMediaTools } from "./tools/media.js";
import { registerNavigationTools } from "./tools/navigation.js";
import { registerTabTools } from "./tools/tabs.js";
import { registerOSInteractionTools } from "./tools/os_interaction.js";
import { parseCliArgs } from "./utils.js";
import { YtdlpClient } from "@framework/mcp-shared";

const MCP_NAME = "apex-browser-mcp";
const MCP_VERSION = "1.6.0";

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));

  const errorHandler = new UnifiedErrorHandler({ mcpName: MCP_NAME });

  const serviceStatus: Record<string, boolean> = {
    browser: true,
    ytdlp: false,
  };

  const browser = new BrowserManager(options);
  const tabs = new TabRegistry(browser);
  const ytdlp = new YtdlpClient({ 
    binaryPath: options.ytdlpPath, 
    downloadDir: options.downloadDir
  });

  // Check yt-dlp availability
  try {
    const { execFileSync } = await import("node:child_process");
    execFileSync(options.ytdlpPath, ["--version"], { timeout: 5000 });
    serviceStatus.ytdlp = true;
  } catch {
    log.warn(MCP_NAME, "ytdlp", "startup", `yt-dlp not found at ${options.ytdlpPath}`);
  }

  log.startup(MCP_NAME, MCP_VERSION, serviceStatus);

  const server = new McpServer({
    name: MCP_NAME,
    version: MCP_VERSION,
  });

  registerNavigationTools(server, { tabs });
  registerInteractionTools(server, { tabs, captchaKey: options.captchaKey });
  registerCaptureTools(server, { tabs });
  registerEvaluateTools(server, { tabs });
  registerTabTools(server, { browser, tabs });
  registerPointerTools(server, { tabs });
  registerMediaTools(server, ytdlp);
  registerOSInteractionTools(server);

  registerHealthTool(server, {
    mcpName: MCP_NAME,
    version: MCP_VERSION,
    errorHandler,
    checks: {
      browser: async () => null, // Browser launches on demand
      ytdlp: async () => {
        try {
          const { execFile } = await import("node:child_process");
          const { promisify } = await import("node:util");
          await promisify(execFile)(options.ytdlpPath, ["--version"], { timeout: 5000 });
          return null;
        } catch (e) {
          return e instanceof Error ? e.message : String(e);
        }
      },
    },
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.ready(MCP_NAME, 40, serviceStatus);

  // Graceful shutdown
  const shutdown = async () => {
    log.info(MCP_NAME, "system", "shutdown", "Shutting down — closing browser");
    try { await (browser as unknown as { browser?: { close(): Promise<void> } }).browser?.close(); } catch { /* best effort */ }
    process.exit(EXIT_CODES.SUCCESS);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch(error => {
  log.error(MCP_NAME, "system", "fatal", error instanceof Error ? error.message : String(error));
  process.exit(EXIT_CODES.FATAL_CONFIG_ERROR);
});
