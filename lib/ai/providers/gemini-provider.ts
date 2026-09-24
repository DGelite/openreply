import {
  AiChatMessage,
  AiProvider,
  AiProviderName,
  CompletionOptions,
  CompletionResult,
} from "../types";

export class GeminiProvider implements AiProvider {
  name: AiProviderName = "GEMINI";
  model: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, model: string = "gemini-2.5-flash-lite", baseUrl?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || "";
    this.model = model || "gemini-2.5-flash-lite";
    this.baseUrl =
      baseUrl ||
      process.env.GEMINI_BASE_URL ||
      "https://generativelanguage.googleapis.com/v1beta";
  }

  async generateCompletion(options: CompletionOptions): Promise<CompletionResult> {
    const startTime = Date.now();
    const cleanModel = this.model.replace(/^models\//, "");
    const endpoint = `${this.baseUrl}/models/${cleanModel}:generateContent?key=${this.apiKey}`;

    const contents = options.messages.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    const systemInstruction = options.systemPrompt
      ? { parts: [{ text: options.systemPrompt }] }
      : undefined;

    const generationConfig: Record<string, unknown> = {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxTokens ?? 1000,
      topP: options.topP ?? 0.95,
      topK: options.topK ?? 40,
    };

    if (options.jsonMode) {
      generationConfig.responseMimeType = "application/json";
    }

    const payload = {
      contents,
      systemInstruction,
      generationConfig,
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const latencyMs = Date.now() - startTime;

    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text ?? "";
    const promptTokens = data.usageMetadata?.promptTokenCount ?? 0;
    const completionTokens = data.usageMetadata?.candidatesTokenCount ?? 0;

    return {
      text,
      provider: "GEMINI",
      model: this.model,
      promptTokens,
      completionTokens,
      latencyMs,
      finishReason: candidate?.finishReason ?? "STOP",
    };
  }

  async generateEmbeddings(text: string | string[]): Promise<number[][]> {
    const inputs = Array.isArray(text) ? text : [text];
    const endpoint = `${this.baseUrl}/models/text-embedding-004:batchEmbedContents?key=${this.apiKey}`;

    const requests = inputs.map((t) => ({
      model: "models/text-embedding-004",
      content: { parts: [{ text: t }] },
    }));

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requests }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini Embedding Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data.embeddings.map((e: { values: number[] }) => e.values);
  }
}
