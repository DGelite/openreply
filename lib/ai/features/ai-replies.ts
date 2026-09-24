import { prisma } from "@/lib/db/client";
import { getAiEngine } from "../factory";
import { evaluatePromptSafety, sanitizeAiOutput } from "../security/guardrails";
import { isAiActive } from "../utils";
import type { AiConfig } from "@/lib/generated/prisma/client";

export interface GenerateReplyParams {
  workspaceId: string;
  userId: string; // Customer IGSID
  userMessage: string;
  brandVoice?: string;
  tone?: string; // "friendly" | "professional" | "sales" | "formal"
  maxLength?: "short" | "medium" | "long";
}

export interface GenerateReplyResult {
  replyText: string;
  confidenceScore: number;
  provider: string;
  model: string;
  isSafe: boolean;
  tokensUsed: number;
}

/**
 * Generates an AI reply for an incoming DM.
 * Returns empty string (silent) when outside active hours with no offline message configured.
 */
export async function generateAiReply(
  params: GenerateReplyParams
): Promise<GenerateReplyResult> {
  const { workspaceId, userId, userMessage, brandVoice, tone = "friendly", maxLength = "medium" } = params;

  // 1. Security Check — evaluate before ANY DB calls
  const safetyCheck = evaluatePromptSafety(userMessage);
  if (!safetyCheck.isSafe) {
    return {
      replyText: safetyCheck.sanitizedText,
      confidenceScore: 1.0,
      provider: "SECURITY_GUARD",
      model: "RULE_ENGINE",
      isSafe: false,
      tokensUsed: 0,
    };
  }

  // 2. Single DB fetch: get both AiConfig and conversation memories in parallel
  const [config, memories] = await Promise.all([
    prisma.aiConfig.findUnique({ where: { workspaceId } }),
    prisma.aiConversationMemory.findMany({
      where: { workspaceId, userId },
      take: 10,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  // 3. Active Hours Gate — check schedule before burning AI tokens
  if (config && !isAiActive(config as AiConfig)) {
    // If there's an offline message configured, return it; otherwise stay silent
    const offlineText = config.offlineMessage?.trim() ?? "";
    return {
      replyText: offlineText,
      confidenceScore: 1.0,
      provider: "SYSTEM",
      model: "OFFLINE_HOURS",
      isSafe: true,
      tokensUsed: 0,
    };
  }

  // 4. Resolve AI Engine Provider (uses same config internally, avoiding a 3rd DB call)
  const aiEngine = await getAiEngine(workspaceId);

  const memoryContext = memories.map((m) => `${m.memoryKey}: ${m.memoryValue}`).join("\n");

  const lengthGuide =
    maxLength === "short"
      ? "پاسخ را بسیار کوتاه و حداکثر در ۱ تا ۲ جمله بنویس."
      : maxLength === "long"
      ? "پاسخ را کامل، توضیحی و مفصل بنویس."
      : "پاسخ را در ۲ تا ۳ جمله متناسب بنویس.";

  // Use workspace's custom system prompt if configured, else fall back to default persona
  const effectiveBrandVoice = brandVoice || config?.brandVoice || "صمیمی، محترمانه و حرفه‌ای";
  const effectiveTone = tone || config?.defaultTone || "friendly";

  const systemPrompt = config?.systemPrompt?.trim()
    ? config.systemPrompt
    : `شما دستیار هوشمند و حرفه‌ای اینستاگرام هستید.
لحن پاسخ شما: ${effectiveTone}.
لحن برند کسب‌وکار: ${effectiveBrandVoice}.
${lengthGuide}

اطلاعات قبلی مخاطب:
${memoryContext || "هیچ دیتای قبلی موجود نیست."}

پاسخ را کاملاً طبیعی، بدون لحن رباتیک و متناسب با نیاز کاربر ارسال کن.`;

  const completion = await aiEngine.generateCompletion({
    systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    temperature: config?.temperature ?? 0.7,
  });

  const cleanText = sanitizeAiOutput(completion.text);

  // 5. Log Audit Event (fire-and-forget, non-blocking)
  prisma.aiAuditLog
    .create({
      data: {
        workspaceId,
        feature: "REPLIES",
        provider: completion.provider,
        model: completion.model,
        promptTokens: completion.promptTokens,
        completionTokens: completion.completionTokens,
        latencyMs: completion.latencyMs,
        confidenceScore: 0.92,
      },
    })
    .catch((err) => console.error("[AI Replies] Audit log failed:", err));

  return {
    replyText: cleanText,
    confidenceScore: 0.92,
    provider: completion.provider,
    model: completion.model,
    isSafe: true,
    tokensUsed: completion.promptTokens + completion.completionTokens,
  };
}
