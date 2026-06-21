import { log } from "@framework/mcp-shared";

export type ModelId = "gemini-2.0-flash" | "gemini-2.0-pro" | "gemma-3-27b-it" | "deep-research-pro-preview-12-2025";

export interface AiConfig {
  geminiApiKey?: string;
  ollamaUrl: string;
}

export class AiClient {
  constructor(private readonly config: AiConfig) {}

  async ask(model: ModelId, prompt: string, systemPrompt?: string): Promise<string> {
    if (model.startsWith("gemini")) {
      return this.askGemini(model, prompt, systemPrompt);
    }
    return this.askOllama(model, prompt, systemPrompt);
  }

  private async askGemini(model: string, prompt: string, systemPrompt?: string): Promise<string> {
    if (!this.config.geminiApiKey) {
      throw new Error("Gemini API key not configured");
    }
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.config.geminiApiKey}`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        system_instruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${error}`);
    }

    const data = await response.json() as any;
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response from Gemini";
  }

  private async askOllama(model: string, prompt: string, systemPrompt?: string): Promise<string> {
    const response = await fetch(`${this.config.ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        system: systemPrompt,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.statusText}`);
    }

    const data = await response.json() as any;
    return data.response || "No response from Ollama";
  }
}
