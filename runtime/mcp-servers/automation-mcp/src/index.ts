#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  UnifiedErrorHandler,
  registerHealthTool,
  log,
  EXIT_CODES,
} from "@framework/mcp-shared";

import { AiClient } from "./ai.js";
import { N8nClient } from "./client.js";
import { registerAiTools } from "./tools/ai.js";
import { registerExecutionTools } from "./tools/executions.js";
import { registerIntelligenceTools } from "./tools/intelligence.js";
import { registerWorkflowTools } from "./tools/workflows.js";
import { openSshTunnel, type SshTunnel } from "./tunnel.js";

const MCP_NAME = "apex-automation-mcp";
const MCP_VERSION = "1.3.1";

interface CliConfig {
  n8nUrl: string;
  apiKey: string;
  timeout: number;
  geminiApiKey: string;
  ollamaUrl: string;
  n8nSshHost?: string;
  n8nSshPort: number;
  n8nSshUser: string;
  n8nSshRemoteHost: string;
  n8nSshRemotePort: number;
}

function parseArgs(argv: string[]): CliConfig {
  const config: CliConfig = {
    n8nUrl: process.env.APEX_N8N_URL || "http://localhost:5678",
    apiKey: process.env.APEX_N8N_API_KEY || "",
    timeout: 30000,
    geminiApiKey: process.env.GEMINI_API_KEY || "",
    ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",
    n8nSshHost: process.env.APEX_N8N_SSH_HOST,
    n8nSshPort: Number.parseInt(process.env.APEX_N8N_SSH_PORT || "22", 10),
    n8nSshUser: process.env.APEX_N8N_SSH_USER || "n8n",
    n8nSshRemoteHost: process.env.APEX_N8N_SSH_REMOTE_HOST || "127.0.0.1",
    n8nSshRemotePort: Number.parseInt(process.env.APEX_N8N_SSH_REMOTE_PORT || "5678", 10),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--n8n-url") {
      if (!next) {
        throw new Error("Missing value for --n8n-url");
      }
      config.n8nUrl = next;
      index += 1;
      continue;
    }

    if (arg.startsWith("--n8n-url=")) {
      config.n8nUrl = arg.slice("--n8n-url=".length);
      continue;
    }

    if (arg === "--api-key") {
      if (!next) {
        throw new Error("Missing value for --api-key");
      }
      config.apiKey = next;
      index += 1;
      continue;
    }

    if (arg.startsWith("--api-key=")) {
      config.apiKey = arg.slice("--api-key=".length);
      continue;
    }

    if (arg === "--timeout") {
      if (!next) {
        throw new Error("Missing value for --timeout");
      }
      const timeout = Number.parseInt(next, 10);
      if (!Number.isFinite(timeout) || timeout <= 0) {
        throw new Error(`Invalid --timeout value: ${next}`);
      }
      config.timeout = timeout;
      index += 1;
      continue;
    }

    if (arg.startsWith("--timeout=")) {
      const timeout = Number.parseInt(arg.slice("--timeout=".length), 10);
      if (!Number.isFinite(timeout) || timeout <= 0) {
        throw new Error(`Invalid --timeout value: ${arg.slice("--timeout=".length)}`);
      }
      config.timeout = timeout;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return config;
}

function registerProcessHandlers(): void {
  process.on("uncaughtException", (error) => {
    log.error(MCP_NAME, "system", "uncaught_exception", error instanceof Error ? error.message : String(error));
  });

  process.on("unhandledRejection", (reason) => {
    log.error(MCP_NAME, "system", "unhandled_rejection", reason instanceof Error ? reason.message : String(reason));
  });
}

async function main(): Promise<void> {
  const config = parseArgs(process.argv.slice(2));
  registerProcessHandlers();
  let n8nTunnel: SshTunnel | undefined;

  const errorHandler = new UnifiedErrorHandler({
    mcpName: MCP_NAME,
    retryOverrides: {
      n8n: { maxRetries: 2, initialDelayMs: 500 },
    },
  });

  // Service health checks
  const serviceStatus: Record<string, boolean> = { n8n: false, ai: false };

  if (config.n8nSshHost) {
    try {
      n8nTunnel = await openSshTunnel({
        sshHost: config.n8nSshHost,
        sshPort: config.n8nSshPort,
        sshUser: config.n8nSshUser,
        remoteHost: config.n8nSshRemoteHost,
        remotePort: config.n8nSshRemotePort,
      });
      config.n8nUrl = `http://127.0.0.1:${n8nTunnel.localPort}`;
    } catch (e) {
      log.warn(MCP_NAME, "n8n", "startup", `n8n SSH tunnel failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const client = new N8nClient({
    baseUrl: config.n8nUrl,
    apiKey: config.apiKey,
    timeout: config.timeout
  });

  // Validate n8n connectivity
  if (config.apiKey) {
    try {
      await client.listWorkflows(1);
      serviceStatus.n8n = true;
    } catch (e) {
      log.warn(MCP_NAME, "n8n", "startup", `n8n unreachable: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    log.warn(MCP_NAME, "n8n", "startup", "No API key configured — n8n tools will fail until APEX_N8N_API_KEY is set");
  }

  const ai = new AiClient({
    geminiApiKey: config.geminiApiKey,
    ollamaUrl: config.ollamaUrl,
  });
  serviceStatus.ai = !!(config.geminiApiKey || config.ollamaUrl);

  log.startup(MCP_NAME, MCP_VERSION, serviceStatus);

  const server = new McpServer({
    name: MCP_NAME,
    version: MCP_VERSION,
  });

  registerWorkflowTools(server, client);
  registerExecutionTools(server, client);
  registerIntelligenceTools(server, client);
  registerAiTools(server, ai);

  registerHealthTool(server, {
    mcpName: MCP_NAME,
    version: MCP_VERSION,
    errorHandler,
    checks: {
      n8n: async () => {
        try {
          await client.listWorkflows(1);
          return null;
        } catch (e) {
          return e instanceof Error ? e.message : String(e);
        }
      },
      gemini: async () => config.geminiApiKey ? null : "No API key configured",
      ollama: async () => {
        try {
          const res = await fetch(`${config.ollamaUrl}/api/tags`);
          return res.ok ? null : `Status ${res.status}`;
        } catch (e) {
          return e instanceof Error ? e.message : String(e);
        }
      },
    },
  });

  // Shutdown handler: close n8n HTTP connections and AI client on signals
  const cleanup = async () => {
    n8nTunnel?.close();
    console.error("[apex-automation-mcp] shutting down...");
  };

  process.on("SIGINT", async () => {
    await cleanup();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await cleanup();
    process.exit(0);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.ready(MCP_NAME, 16, serviceStatus);

  // Graceful shutdown
  const shutdown = () => {
    log.info(MCP_NAME, "system", "shutdown", "Shutting down gracefully");
    process.exit(EXIT_CODES.SUCCESS);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  log.error(MCP_NAME, "system", "fatal", error instanceof Error ? error.message : String(error));
  process.exit(EXIT_CODES.FATAL_CONFIG_ERROR);
});
