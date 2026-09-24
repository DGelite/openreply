import { prisma } from "@/lib/db/client";
import { AiProvider } from "./types";
import { GeminiProvider } from "./providers/gemini-provider";
import { OpenAIProvider } from "./providers/openai-provider";
import { safeDecryptToken } from "@/lib/meta/oauth";

export async function getAiEngine(workspaceId: string): Promise<AiProvider> {
  const config = await prisma.aiConfig.findUnique({
    where: { workspaceId },
  });

  if (!config || !config.isEnabled) {
    // Default to Gemini Provider using environment variables
    return new GeminiProvider(
      process.env.GEMINI_API_KEY || "",
      process.env.GEMINI_MODEL || "gemini-2.5-flash"
    );
  }

  let apiKey = process.env.GEMINI_API_KEY || "";
  if (config.apiKeyEncrypted) {
    try {
      apiKey = safeDecryptToken(config.apiKeyEncrypted);
    } catch {
      // Fallback if decryption fails
      apiKey = process.env.GEMINI_API_KEY || "";
    }
  }

  switch (config.provider) {
    case "OPENAI":
      return new OpenAIProvider(apiKey, config.model, config.baseUrl || undefined, "OPENAI");
    case "ANTHROPIC":
      return new OpenAIProvider(apiKey, config.model, config.baseUrl || "https://api.anthropic.com/v1", "ANTHROPIC");
    case "DEEPSEEK":
      return new OpenAIProvider(apiKey, config.model, config.baseUrl || "https://api.deepseek.com", "DEEPSEEK");
    case "GROK":
      return new OpenAIProvider(apiKey, config.model, config.baseUrl || "https://api.x.ai/v1", "GROK");
    case "OPENROUTER":
      return new OpenAIProvider(apiKey, config.model, config.baseUrl || "https://openrouter.ai/api/v1", "OPENROUTER");
    case "OLLAMA":
      return new OpenAIProvider("", config.model, config.baseUrl || "http://localhost:11434/v1", "OLLAMA");
    case "GEMINI":
    default:
      return new GeminiProvider(apiKey, config.model, config.baseUrl || undefined);
  }
}
