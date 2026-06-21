import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AiClient, AVAILABLE_MODELS } from "../ai.js";
import { toolError, toolResult } from "@framework/mcp-shared";

export function registerAiTools(server: McpServer, ai: AiClient): void {
  server.tool(
    "ai_ask",
    "Send a prompt to Gemini or a local Ollama model. Use for second opinions, extended context, research, or when you want a different model's perspective.",
    {
      prompt: z.string().min(1).describe("The prompt or question to send"),
      model: z
        .enum(["gemini-2.0-flash", "gemini-2.5-pro-preview-03-25", "llama3.2", "gemma3"])
        .optional()
        .describe("Model to use (default: gemini-2.0-flash)"),
      system_prompt: z
        .string()
        .optional()
        .describe("Optional system prompt to set context or persona"),
    },
    async ({ prompt, model = "gemini-2.0-flash", system_prompt }) => {
      try {
        const choice = AVAILABLE_MODELS.find((m) => m.model === model) ?? AVAILABLE_MODELS[0]!;
        const response = await ai.ask(choice.provider, choice.model, prompt, system_prompt);
        return toolResult(`[${choice.label}]\n\n${response}`);
      } catch (e) {
        return toolError(e);
      }
    }
  );

  server.tool(
    "ai_consensus",
    "Ask the same question to multiple models (Gemini Flash + Gemini Pro, or Gemini + local Ollama) and compare their answers side by side. Best for important decisions, code reviews, or when you need confidence.",
    {
      prompt: z.string().min(1).describe("The question or task to send to all models"),
      models: z
        .array(z.enum(["gemini-2.0-flash", "gemini-2.5-pro-preview-03-25", "llama3.2", "gemma3"]))
        .min(2)
        .max(4)
        .optional()
        .describe("Models to query (default: gemini-2.0-flash + gemini-2.5-pro)"),
      system_prompt: z
        .string()
        .optional()
        .describe("Optional system prompt applied to all models"),
    },
    async ({ prompt, models = ["gemini-2.0-flash", "gemini-2.5-pro-preview-03-25"], system_prompt }) => {
      try {
        const responses = await Promise.allSettled(
          models.map(async (modelId) => {
            const choice = AVAILABLE_MODELS.find((m) => m.model === modelId)!;
            const response = await ai.ask(choice.provider, choice.model, prompt, system_prompt);
            return { label: choice.label, response };
          })
        );

        const sections = responses.map((result, i) => {
          const modelId = models[i]!;
          if (result.status === "fulfilled") {
            return `## ${result.value.label}\n\n${result.value.response}`;
          }
          return `## ${modelId}\n\nError: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`;
        });

        return toolResult(`# Multi-Model Consensus\n\nPrompt: ${prompt}\n\n---\n\n${sections.join("\n\n---\n\n")}`);
      } catch (e) {
        return toolError(e);
      }
    }
  );

  server.tool(
    "ai_models",
    "List all available AI models you can query via ai_ask or ai_consensus — shows Gemini models and any locally running Ollama models.",
    {},
    async () => {
      try {
        const ollamaModels = await ai.listOllamaModels();

        const lines = [
          "Available AI models:",
          "",
          "Gemini (cloud):",
          ...AVAILABLE_MODELS.filter((m) => m.provider === "gemini").map((m) => `  ${m.model} — ${m.label}`),
          "",
          "Ollama (local):",
          ...(ollamaModels.length > 0
            ? ollamaModels.map((m) => `  ${m}`)
            : ["  (none running — start Ollama or install a model with: ollama pull llama3.2)"]),
        ];

        return toolResult(lines.join("\n"));
      } catch (e) {
        return toolError(e);
      }
    }
  );
}
