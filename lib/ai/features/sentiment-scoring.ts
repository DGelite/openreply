import { prisma } from "@/lib/db/client";
import { getAiEngine } from "../factory";
import { normalizePersian } from "@/lib/utils/keyword-matcher";

export interface SentimentAnalysisResult {
  sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  buyerScore: number; // 1 - 100
  intentCategory: string;
  summary: string;
}

const sentimentCache = new Map<string, { result: SentimentAnalysisResult; expiresAt: number }>();
const SENTIMENT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_SENTIMENT_CACHE_SIZE = 200;

export function clearSentimentCache(): void {
  sentimentCache.clear();
}

/**
 * Fast deterministic heuristics for common sentiment phrases.
 */
function checkDeterministicSentiment(cleanText: string): SentimentAnalysisResult | null {
  const normalized = normalizePersian(cleanText).toLowerCase().trim();
  const t = normalized.replace(/\s+/g, " ");
  const positiveWords = ["مرسی", "ممنون", "تشکر", "خیلی ممنون", "دستتون درد نکنه", "عالیه", "فوق العاده", "دمتون گرم", "سپاس", "thanks", "thank you"];
  if (positiveWords.includes(t) || (positiveWords.some((w) => t.includes(w)) && t.length <= 35)) {
    return {
      sentiment: "POSITIVE",
      buyerScore: 75,
      intentCategory: "GRATITUDE",
      summary: "Rule engine: پیام تشکر و رضایت مشتری.",
    };
  }
  return null;
}

/**
 * Analyzes customer message sentiment and evaluates buyer lead score (1-100).
 */
export async function analyzeSentimentAndBuyerScore(
  workspaceId: string,
  userMessage: string
): Promise<SentimentAnalysisResult> {
  if (!userMessage || userMessage.trim().length === 0) {
    return {
      sentiment: "NEUTRAL",
      buyerScore: 50,
      intentCategory: "GENERAL",
      summary: "پیام خالی است.",
    };
  }

  const cleanMessage = userMessage.trim();

  // Fast-path: deterministic sentiment without API call
  const fastMatch = checkDeterministicSentiment(cleanMessage);
  if (fastMatch) {
    return fastMatch;
  }

  const normalizedKey = normalizePersian(cleanMessage).toLowerCase().trim();
  const cacheKey = `${workspaceId}:${normalizedKey}`;
  const now = Date.now();
  const cached = sentimentCache.get(cacheKey);
  if (cached) {
    if (now < cached.expiresAt) {
      return cached.result;
    }
    sentimentCache.delete(cacheKey);
  }

  try {
    const aiEngine = await getAiEngine(workspaceId);
    const systemPrompt = `شما تحلیل‌گر احساسات و امتیاز سیگنال خرید مشتری (Sentiment & Buyer Score Analyst) هستید.
تحلیل نیت کاربر، احساسات (POSITIVE, NEUTRAL, NEGATIVE) و امتیاز قصد خرید (۱ تا ۱۰۰) را محاسبه کنید.

مثال خروجی JSON:
{
  "sentiment": "POSITIVE",
  "buyerScore": 85,
  "intentCategory": "PURCHASE_INTENT",
  "summary": "مشتری آمادگی خرید بالا و سوال درباره شماره کارت دارد."
}`;

    const completion = await aiEngine.generateCompletion({
      systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      jsonMode: true,
    });

    const parsed = JSON.parse(completion.text);
    const result: SentimentAnalysisResult = {
      sentiment: parsed.sentiment || "NEUTRAL",
      buyerScore: typeof parsed.buyerScore === "number" ? Math.min(100, Math.max(1, parsed.buyerScore)) : 50,
      intentCategory: parsed.intentCategory || "GENERAL",
      summary: parsed.summary || "",
    };
    if (sentimentCache.size >= MAX_SENTIMENT_CACHE_SIZE) {
      const oldest = sentimentCache.keys().next().value;
      if (oldest) sentimentCache.delete(oldest);
    }
    sentimentCache.set(cacheKey, { result, expiresAt: now + SENTIMENT_CACHE_TTL_MS });
    return result;
  } catch (error) {
    console.error("[AI Sentiment Analysis Error]:", error);
    return {
      sentiment: "NEUTRAL",
      buyerScore: 50,
      intentCategory: "GENERAL",
      summary: "ارزیابی هوشمند احساسات با خطا مواجه شد.",
    };
  }
}
