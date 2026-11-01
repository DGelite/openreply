import {
  AiProvider,
  AiProviderName,
  CompletionOptions,
  CompletionResult,
} from "../types";

export class OpenAIProvider implements AiProvider {
  name: AiProviderName;
  model: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(
    apiKey: string,
    model: string = "gpt-4o-mini",
    baseUrl: string = "https://api.openai.com/v1",
    providerName: AiProviderName = "OPENAI"
  ) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || "";
    this.model = model;
    this.baseUrl = baseUrl;
    this.name = providerName;
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
      throw new Error(`${this.name} Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const latencyMs = Date.now() - startTime;
    const choice = data.choices?.[0];

    return {
      text: choice?.message?.content ?? "",
      provider: this.name,
      model: this.model,
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      latencyMs,
      finishReason: choice?.finish_reason ?? "stop",
    };
  }
}
