export interface AiConfig {
  geminiApiKey: string;
  ollamaUrl: string;
}

export type ModelProvider = "gemini" | "ollama";

export interface ModelChoice {
  provider: ModelProvider;
  model: string;
  label: string;
}

export const AVAILABLE_MODELS: ModelChoice[] = [
  { provider: "gemini", model: "gemini-2.0-flash", label: "Gemini 2.0 Flash (fast)" },
  { provider: "gemini", model: "gemini-2.5-pro-preview-03-25", label: "Gemini 2.5 Pro (deep thinking)" },
  { provider: "ollama", model: "llama3.2", label: "Llama 3.2 (local, private)" },
  { provider: "ollama", model: "qwen3:8b", label: "Qwen3 8B (local, private)" },
];

export class AiClient {
  private geminiKey: string;
  private ollamaUrl: string;

  constructor(config: AiConfig) {
    this.geminiKey = config.geminiApiKey;
    this.ollamaUrl = config.ollamaUrl.replace(/\/$/, "");
  }

  async askGemini(model: string, prompt: string, systemPrompt?: string): Promise<string> {
    if (!this.geminiKey) throw new Error("GEMINI_API_KEY not set");

    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    if (systemPrompt) {
      contents.push({ role: "user", parts: [{ text: systemPrompt }] });
      contents.push({ role: "model", parts: [{ text: "Understood." }] });
    }
    contents.push({ role: "user", parts: [{ text: prompt }] });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.geminiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${err.slice(0, 300)}`);
    }

    const data = await res.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "(no response)";
  }

  async askOllama(model: string, prompt: string, systemPrompt?: string): Promise<string> {
    const body: Record<string, unknown> = { model, prompt, stream: false };
    if (systemPrompt) body["system"] = systemPrompt;

    const res = await fetch(`${this.ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Ollama error ${res.status}: ${err.slice(0, 300)}`);
    }

    const data = await res.json() as { response?: string };
    return data.response ?? "(no response)";
  }

  async ask(provider: ModelProvider, model: string, prompt: string, systemPrompt?: string): Promise<string> {
    if (provider === "gemini") return this.askGemini(model, prompt, systemPrompt);
    return this.askOllama(model, prompt, systemPrompt);
  }

  async listOllamaModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.ollamaUrl}/api/tags`);
      if (!res.ok) return [];
      const data = await res.json() as { models?: Array<{ name: string }> };
      return (data.models ?? []).map((m) => m.name);
    } catch {
      return [];
    }
  }
}
