#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createApexServer, log, EXIT_CODES } from "@framework/mcp-shared";
import { AiClient } from "./ai.js";
import { registerAiTools } from "./tools/ai.js";

const MCP_NAME = "apex-ai-mcp";
const MCP_VERSION = "1.0.0";

async function main() {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";

  const ai = new AiClient({ geminiApiKey, ollamaUrl });

  const { server } = createApexServer({
    mcpName: MCP_NAME,
    version: MCP_VERSION,
    healthChecks: {
      gemini: async () => geminiApiKey ? null : "No API key configured",
      ollama: async () => {
        try {
          const res = await fetch(`${ollamaUrl}/api/tags`);
          return res.ok ? null : `Status ${res.status}`;
        } catch (e) {
          return e instanceof Error ? e.message : String(e);
        }
      }
    }
  });

  registerAiTools(server, ai);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  log.info(MCP_NAME, "system", "ready", `AI MCP v${MCP_VERSION} operational`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(EXIT_CODES.FATAL_CONFIG_ERROR);
});
