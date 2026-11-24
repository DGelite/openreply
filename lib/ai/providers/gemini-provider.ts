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
  private apiKeys: string[] = [];
  private activeKeyIndex = 0;
  private baseUrl: string;

  constructor(apiKey: string | string[], model: string = "gemini-2.5-flash", baseUrl?: string) {
    if (Array.isArray(apiKey)) {
      this.apiKeys = apiKey.map((k) => k.trim()).filter(Boolean);
    } else if (typeof apiKey === "string" && apiKey.trim()) {
      this.apiKeys = apiKey.split(/[\r\n,;]+/).map((k) => k.trim()).filter(Boolean);
    }

    // Fallback to environment variables if no keys provided
    if (this.apiKeys.length === 0 && process.env.GEMINI_API_KEY) {
      this.apiKeys = process.env.GEMINI_API_KEY.split(/[\r\n,;]+/).map((k) => k.trim()).filter(Boolean);
    }

    this.model = model || "gemini-2.5-flash";
    this.baseUrl =
      baseUrl ||
      process.env.GEMINI_BASE_URL ||
      "https://generativelanguage.googleapis.com/v1beta";
  }

  getAvailableKeysCount(): number {
    return this.apiKeys.length;
  }

  get currentApiKey(): string {
    return this.apiKeys[this.activeKeyIndex] || "";
  }

  async generateCompletion(options: CompletionOptions): Promise<CompletionResult> {
    const startTime = Date.now();
    const cleanModel = this.model.replace(/^models\//, "");

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

    const keysToTry = Math.max(1, this.apiKeys.length);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < keysToTry; attempt++) {
      const keyIndex = (this.activeKeyIndex + attempt) % this.apiKeys.length;
      const activeKey = this.apiKeys[keyIndex];
      const endpoint = `${this.baseUrl}/models/${cleanModel}:generateContent?key=${activeKey}`;

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(15_000),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.warn(
            `[Gemini Key Failover] Key #${keyIndex + 1} failed with HTTP ${response.status}. Trying next key...`
          );
          lastError = new Error(`Gemini API Error ${response.status}: ${errorText}`);
          continue; // Try next key in pool
        }

        const data = await response.json();
        const latencyMs = Date.now() - startTime;

        // Remember the successful working key index for future requests
        this.activeKeyIndex = keyIndex;

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
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(
          `[Gemini Key Failover] Attempt #${attempt + 1} with key #${keyIndex + 1} failed (${lastError.message}).`
        );
      }
    }

    throw lastError || new Error("All Gemini API keys in failover pool exhausted");
  }

  async generateEmbeddings(text: string | string[]): Promise<number[][]> {
    const inputs = Array.isArray(text) ? text : [text];
    const endpoint = `${this.baseUrl}/models/text-embedding-004:batchEmbedContents?key=${this.currentApiKey}`;

    const requests = inputs.map((t) => ({
      model: "models/text-embedding-004",
      content: { parts: [{ text: t }] },
    }));

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requests }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini Embedding Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data.embeddings.map((e: { values: number[] }) => e.values);
  }
}
