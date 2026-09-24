import { prisma } from "@/lib/db/client";
import { getAiEngine } from "../factory";

export interface HandoverDetectionResult {
  requiresHandover: boolean;
  reason: string;
  confidenceScore: number;
}

/**
 * Detects whether an incoming user DM requires human agent escalation (Handover).
 */
export async function detectHumanHandoverNeed(
  workspaceId: string,
  userMessage: string
): Promise<HandoverDetectionResult> {
  const lowercaseMsg = userMessage.toLowerCase().trim();

  // Fast pattern matching keywords for instant zero-latency handover
  const handoverKeywords = ["پشتیبان", "اپراتور", "انسان", "مدیر", "وصل کن", "ادمین", "operator", "human", "agent", "support"];
  const directMatch = handoverKeywords.some((kw) => lowercaseMsg.includes(kw));

  if (directMatch) {
    return {
      requiresHandover: true,
      reason: "درخواست مستقیم ارتباط با پشتیبان یا ادمین",
      confidenceScore: 1.0,
    };
  }

  try {
    const aiEngine = await getAiEngine(workspaceId);
    const systemPrompt = `شما تشخیص‌دهنده نیاز به مداخله اپراتور انسانی (Human Handover Detector) هستید.
ارزیابی کنید آیا پیام مشتری حاوی عصبانیت، عدم رضایت شدید، یا درخواست پیگیری ادمین انسانی است یا خیر.

خروجی JSON:
{
  "requiresHandover": true,
  "reason": "مشتری از عدم دریافت سفارش ناراضی است و درخواست ادمین دارد.",
  "confidenceScore": 0.95
}`;

    const completion = await aiEngine.generateCompletion({
      systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      jsonMode: true,
    });

    const parsed = JSON.parse(completion.text);
    return {
      requiresHandover: Boolean(parsed.requiresHandover),
      reason: parsed.reason || "نیاز به پاسخگویی اپراتور",
      confidenceScore: parsed.confidenceScore || 0.8,
    };
  } catch {
    return {
      requiresHandover: false,
      reason: "",
      confidenceScore: 0.5,
    };
  }
}
