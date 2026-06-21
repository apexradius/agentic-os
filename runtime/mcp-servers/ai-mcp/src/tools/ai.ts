import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AiClient, ModelId } from "../ai.js";
import { geminiTextResult, toolError } from "@framework/mcp-shared";

export function registerAiTools(server: McpServer, ai: AiClient) {
  server.tool(
    "ai_ask",
    "Send a prompt to Gemini or a local Ollama model.",
    {
      model: z.enum(["gemini-2.0-flash", "gemini-2.0-pro", "gemma-3-27b-it", "deep-research-pro-preview-12-2025"]).default("gemini-2.0-flash"),
      prompt: z.string().min(1),
      system_prompt: z.string().optional()
    },
    async ({ model, prompt, system_prompt }) => {
      try {
        const response = await ai.ask(model as ModelId, prompt, system_prompt);
        return geminiTextResult(response, `Response from ${model}`);
      } catch (e) {
        return toolError(e);
      }
    }
  );

  server.tool(
    "ai_consensus",
    "Ask the same question to multiple models and compare side-by-side.",
    {
      models: z.array(z.enum(["gemini-2.0-flash", "gemini-2.0-pro", "gemma-3-27b-it", "deep-research-pro-preview-12-2025"])).min(2).default(["gemini-2.0-flash", "gemini-2.0-pro"]),
      prompt: z.string().min(1),
      system_prompt: z.string().optional()
    },
    async ({ models, prompt, system_prompt }) => {
      try {
        const results = await Promise.all(
          models.map(async (model) => {
            try {
              const res = await ai.ask(model as ModelId, prompt, system_prompt);
              return `#### ${model}\n\n${res}`;
            } catch (err) {
              return `#### ${model}\n\nError: ${err instanceof Error ? err.message : String(err)}`;
            }
          })
        );
        return geminiTextResult(results.join("\n\n---\n\n"), "Multi-Model Consensus");
      } catch (e) {
        return toolError(e);
      }
    }
  );
}
