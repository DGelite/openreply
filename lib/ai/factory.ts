import { prisma } from "@/lib/db/client";
import { AiProvider, CompletionOptions, CompletionResult } from "./types";
import { GeminiProvider } from "./providers/gemini-provider";
import { OpenAIProvider } from "./providers/openai-provider";
import { BoxApiAiProvider } from "./providers/boxapi-ai-provider";
import { safeDecryptToken } from "@/lib/meta/oauth";

interface CachedAiEngine {
  engine: AiProvider;
  expiresAt: number;
}

const aiEngineCache = new Map<string, CachedAiEngine>();
const embeddingEngineCache = new Map<string, CachedAiEngine>();
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
    embeddingEngineCache.delete(workspaceId);
  } else {
    aiEngineCache.clear();
    embeddingEngineCache.clear();
  }
}

function resolveKey(encrypted?: string | null, envFallback?: string): string {
  if (encrypted) {
    try {
      const dec = safeDecryptToken(encrypted);
      if (dec) return dec;
    } catch {
      // fallback
    }
  }
  return envFallback || "";
}

/**
 * Creates and returns the active AI completion engine for a workspace.
 * Strictly respects the chosen provider with NO unauthorized fallback to BoxAPI.
 */
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
    const defaultGemini = new GeminiProvider(
      process.env.GEMINI_API_KEY || "",
      process.env.GEMINI_MODEL || "gemini-2.5-flash"
    );
    setCachedAiEngine(workspaceId, defaultGemini, now);
    return defaultGemini;
  }

  let engine: AiProvider;
  const legacyKey = resolveKey(config.apiKeyEncrypted);

  switch (config.provider) {
    case "OPENAI": {
      const openAiKey = resolveKey(config.openAiApiKeyEncrypted, process.env.OPENAI_API_KEY) || legacyKey;
      const openAiModel = config.openAiModel || config.model || "gpt-4o-mini";
      const baseUrl = config.baseUrl || "https://api.openai.com/v1";
      engine = new OpenAIProvider(openAiKey, openAiModel, baseUrl, "OPENAI");
      break;
    }

    case "BOXAPI": {
      if (!config.boxApiAiEnabled) {
        throw new Error(
          "سرویس BoxAPI AI غیرفعال است. جهت استفاده، لطفاً ابتدا آن را به صورت صریح در پنل مدیریت فعال کنید."
        );
      }
      const boxApiKey =
        resolveKey(config.boxApiAiKeyEncrypted, process.env.BOXAPI_DATA_TOKEN || process.env.BOXAPI_API_KEY) ||
        legacyKey;
      const boxApiModel = config.boxApiAiModel || config.model || "gpt-4o-mini";
      const baseUrl = config.boxApiAiBaseUrl || config.baseUrl || "https://boxapi.ir/api/v1";
      engine = new BoxApiAiProvider(boxApiKey, boxApiModel, baseUrl);
      break;
    }

    case "ANTHROPIC": {
      const anthropicKey = legacyKey || process.env.ANTHROPIC_API_KEY || "";
      engine = new OpenAIProvider(anthropicKey, config.model, config.baseUrl || "https://api.anthropic.com/v1", "ANTHROPIC");
      break;
    }

    case "DEEPSEEK": {
      const deepseekKey = legacyKey || process.env.DEEPSEEK_API_KEY || "";
      engine = new OpenAIProvider(deepseekKey, config.model, config.baseUrl || "https://api.deepseek.com", "DEEPSEEK");
      break;
    }

    case "GEMINI":
    default: {
      const geminiKey = resolveKey(config.geminiApiKeyEncrypted, process.env.GEMINI_API_KEY) || legacyKey;
      const geminiModel = config.geminiModel || config.model || "gemini-2.5-flash";
      const baseUrl = config.baseUrl || undefined;
      engine = new GeminiProvider(geminiKey, geminiModel, baseUrl);
      break;
    }
  }

  // Wrap with logging and strict fallback enforcement
  const wrappedEngine: AiProvider = {
    name: engine.name,
    model: engine.model,
    generateEmbeddings: engine.generateEmbeddings ? engine.generateEmbeddings.bind(engine) : undefined,
    async generateCompletion(options: CompletionOptions): Promise<CompletionResult> {
      console.log(
        `[AI Request] Workspace: ${workspaceId} | Provider: ${engine.name} | Model: ${engine.model}`
      );
      try {
        return await engine.generateCompletion(options);
      } catch (err) {
        // Fallback only if explicitly allowed AND BoxAPI AI is enabled AND primary failed
        if (config.allowAiFallback && config.boxApiAiEnabled && engine.name !== "BOXAPI") {
          console.warn(
            `[AI Fallback] Primary provider ${engine.name} failed (${err instanceof Error ? err.message : String(err)}). Fallback allowed to BoxAPI.`
          );
          const boxApiKey =
            resolveKey(config.boxApiAiKeyEncrypted, process.env.BOXAPI_DATA_TOKEN || process.env.BOXAPI_API_KEY) ||
            legacyKey;
          const fallbackEngine = new BoxApiAiProvider(
            boxApiKey,
            config.boxApiAiModel || "gpt-4o-mini",
            config.boxApiAiBaseUrl || "https://boxapi.ir/api/v1"
          );
          return await fallbackEngine.generateCompletion(options);
        }

        // Strict default: rethrow without switching
        throw err;
      }
    },
  };

  setCachedAiEngine(workspaceId, wrappedEngine, now);
  return wrappedEngine;
}

/**
 * Returns an independent Embedding engine for knowledge base and RAG.
 */
export async function getEmbeddingEngine(workspaceId: string): Promise<AiProvider> {
  const now = Date.now();
  const cached = embeddingEngineCache.get(workspaceId);
  if (cached && now < cached.expiresAt) {
    return cached.engine;
  }

  const config = await prisma.aiConfig.findUnique({
    where: { workspaceId },
  });

  const embeddingProvider = config?.embeddingProvider || "GEMINI";
  const embeddingModel = config?.embeddingModel || (embeddingProvider === "OPENAI" ? "text-embedding-3-small" : "text-embedding-004");
  const legacyKey = resolveKey(config?.apiKeyEncrypted);

  let engine: AiProvider;
  switch (embeddingProvider) {
    case "OPENAI": {
      const key = resolveKey(config?.openAiApiKeyEncrypted, process.env.OPENAI_API_KEY) || legacyKey;
      engine = new OpenAIProvider(key, embeddingModel, "https://api.openai.com/v1", "OPENAI");
      break;
    }
    case "BOXAPI": {
      if (!config?.boxApiAiEnabled) {
        // If BoxAPI AI is disabled, fall back safely to Gemini for embeddings
        const geminiKey = resolveKey(config?.geminiApiKeyEncrypted, process.env.GEMINI_API_KEY) || legacyKey;
        engine = new GeminiProvider(geminiKey, "text-embedding-004", "https://generativelanguage.googleapis.com/v1beta");
        break;
      }
      const key = resolveKey(config?.boxApiAiKeyEncrypted, process.env.BOXAPI_DATA_TOKEN || process.env.BOXAPI_API_KEY) || legacyKey;
      engine = new BoxApiAiProvider(key, embeddingModel, config?.boxApiAiBaseUrl || "https://boxapi.ir/api/v1");
      break;
    }
    case "GEMINI":
    default: {
      const key = resolveKey(config?.geminiApiKeyEncrypted, process.env.GEMINI_API_KEY) || legacyKey;
      engine = new GeminiProvider(key, embeddingModel, "https://generativelanguage.googleapis.com/v1beta");
      break;
    }
  }

  embeddingEngineCache.set(workspaceId, { engine, expiresAt: now + AI_ENGINE_CACHE_TTL_MS });
  return engine;
}
