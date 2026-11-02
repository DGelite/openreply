import {
  AiProvider,
  AiProviderName,
  CompletionOptions,
  CompletionResult,
} from "../types";

export class BoxApiAiProvider implements AiProvider {
  name: AiProviderName = "BOXAPI";
  model: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(
    apiKeyOrOptions?: string | { apiKey?: string; model?: string; baseUrl?: string },
    model: string = "gpt-4o-mini",
    baseUrl: string = "https://boxapi.ir/api/v1"
  ) {
    if (typeof apiKeyOrOptions === "object" && apiKeyOrOptions !== null) {
      this.apiKey = apiKeyOrOptions.apiKey || process.env.BOXAPI_DATA_TOKEN || process.env.BOXAPI_API_KEY || "";
      this.model = apiKeyOrOptions.model || model;
      this.baseUrl = (apiKeyOrOptions.baseUrl || baseUrl).replace(/\/+$/, "");
    } else {
      this.apiKey = apiKeyOrOptions || process.env.BOXAPI_DATA_TOKEN || process.env.BOXAPI_API_KEY || "";
      this.model = model;
      this.baseUrl = baseUrl.replace(/\/+$/, "");
    }
  }

  async generateCompletion(options: CompletionOptions): Promise<CompletionResult> {
    const startTime = Date.now();
    const endpoint = `${this.baseUrl}/chat/completions`;

    const messages = [];
    if (options.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }
    messages.push(
      ...options.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }))
    );

    const payload: Record<string, unknown> = {
      model: this.model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1000,
      top_p: options.topP ?? 0.95,
    };

    if (options.jsonMode) {
      payload.response_format = { type: "json_object" };
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`BoxAPI AI Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const latencyMs = Date.now() - startTime;
    const choice = data.choices?.[0];

    return {
      text: choice?.message?.content || "",
      provider: "BOXAPI",
      model: data.model || this.model,
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      latencyMs,
      confidenceScore: choice?.finish_reason === "stop" ? 0.95 : 0.8,
      finishReason: choice?.finish_reason || "unknown",
    };
  }

  async generateEmbeddings(
    text: string | string[],
    model: string = "text-embedding-3-small"
  ): Promise<number[][]> {
    const inputs = Array.isArray(text) ? text : [text];
    const endpoint = `${this.baseUrl}/embeddings`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: inputs,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`BoxAPI Embedding Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data.data.map((item: { embedding: number[] }) => item.embedding);
  }
}
