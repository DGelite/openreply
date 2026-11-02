import { prisma } from "@/lib/db/client";
import { AiProvider } from "./types";
import { GeminiProvider } from "./providers/gemini-provider";
import { OpenAIProvider } from "./providers/openai-provider";
import { BoxApiAiProvider } from "./providers/boxapi-ai-provider";
import { safeDecryptToken } from "@/lib/meta/oauth";

interface CachedAiEngine {
  engine: AiProvider;
  expiresAt: number;
}

const aiEngineCache = new Map<string, CachedAiEngine>();
const AI_ENGINE_CACHE_TTL_MS = 60_000; // 60 seconds
const AI_ENGINE_CACHE_MAX_ENTRIES = 100;

function setCachedAiEngine(workspaceId: string, engine: AiProvider, now: number) {
  if (aiEngineCache.size >= AI_ENGINE_CACHE_MAX_ENTRIES) {
    const oldest = aiEngineCache.keys().next().value;
    if (oldest) aiEngineCache.delete(oldest);
  }
  aiEngineCache.set(workspaceId, { engine, expiresAt: now + AI_ENGINE_CACHE_TTL_MS });
}

export function clearAiEngineCache(workspaceId?: string): void {
  if (workspaceId) {
    aiEngineCache.delete(workspaceId);
  } else {
    aiEngineCache.clear();
  }
}

export async function getAiEngine(workspaceId: string): Promise<AiProvider> {
  const now = Date.now();
  const cached = aiEngineCache.get(workspaceId);
  if (cached && now < cached.expiresAt) {
    return cached.engine;
  }

  const config = await prisma.aiConfig.findUnique({
    where: { workspaceId },
  });

  if (!config || !config.isEnabled) {
    // Default to Gemini Provider using environment variables
    const engine = new GeminiProvider(
      process.env.GEMINI_API_KEY || "",
      process.env.GEMINI_MODEL || "gemini-2.5-flash"
    );
    setCachedAiEngine(workspaceId, engine, now);
    return engine;
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

  let engine: AiProvider;
  switch (config.provider) {
    case "OPENAI":
      engine = new OpenAIProvider(apiKey, config.model, config.baseUrl || undefined, "OPENAI");
      break;
    case "BOXAPI":
      engine = new BoxApiAiProvider(apiKey, config.model, config.baseUrl || "https://boxapi.ir/api/v1");
      break;
    case "ANTHROPIC":
      engine = new OpenAIProvider(apiKey, config.model, config.baseUrl || "https://api.anthropic.com/v1", "ANTHROPIC");
      break;
    case "DEEPSEEK":
      engine = new OpenAIProvider(apiKey, config.model, config.baseUrl || "https://api.deepseek.com", "DEEPSEEK");
      break;
    case "GROK":
      engine = new OpenAIProvider(apiKey, config.model, config.baseUrl || "https://api.x.ai/v1", "GROK");
      break;
    case "OPENROUTER":
      engine = new OpenAIProvider(apiKey, config.model, config.baseUrl || "https://openrouter.ai/api/v1", "OPENROUTER");
      break;
    case "OLLAMA":
      engine = new OpenAIProvider("", config.model, config.baseUrl || "http://localhost:11434/v1", "OLLAMA");
      break;
    case "GEMINI":
    default:
      engine = new GeminiProvider(apiKey, config.model, config.baseUrl || undefined);
      break;
  }

  setCachedAiEngine(workspaceId, engine, now);
  return engine;
}
