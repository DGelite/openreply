export type AiProviderName =
  | "GEMINI"
  | "OPENAI"
  | "ANTHROPIC"
  | "DEEPSEEK"
  | "GROK"
  | "OPENROUTER"
  | "OLLAMA"
  | "AZURE_OPENAI"
  | "AWS_BEDROCK"
  | "CUSTOM";

export interface AiChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  name?: string;
}

export interface CompletionOptions {
  messages: AiChatMessage[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  jsonMode?: boolean;
  jsonSchema?: Record<string, unknown>;
  stopSequences?: string[];
}

export interface CompletionResult {
  text: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  confidenceScore?: number;
  finishReason?: string;
}

export interface AiProvider {
  name: AiProviderName;
  model: string;
  generateCompletion(options: CompletionOptions): Promise<CompletionResult>;
  generateEmbeddings?(text: string | string[]): Promise<number[][]>;
}
