import { prisma } from "@/lib/db/client";
import { getAiEngine } from "../factory";

export interface SentimentAnalysisResult {
  sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  buyerScore: number; // 1 - 100
  intentCategory: string;
  summary: string;
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
    return {
      sentiment: parsed.sentiment || "NEUTRAL",
      buyerScore: typeof parsed.buyerScore === "number" ? Math.min(100, Math.max(1, parsed.buyerScore)) : 50,
      intentCategory: parsed.intentCategory || "GENERAL",
      summary: parsed.summary || "",
    };
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
