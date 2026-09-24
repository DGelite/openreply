import { prisma } from "@/lib/db/client";
import { getAiEngine } from "../factory";

export type IntentCategory =
  | "PRICING"
  | "PURCHASE"
  | "COMPLAINT"
  | "REFUND"
  | "GREETING"
  | "SUPPORT"
  | "TECHNICAL_ISSUE"
  | "APPOINTMENT"
  | "SALES"
  | "LEAD_QUALIFICATION"
  | "UNKNOWN";

export interface IntentClassificationResult {
  primaryIntent: IntentCategory;
  confidenceScore: number;
  secondaryIntents: IntentCategory[];
  reasoning?: string;
}

export async function classifyIntent(
  workspaceId: string,
  userMessage: string
): Promise<IntentClassificationResult> {
  if (!userMessage || userMessage.trim().length === 0) {
    return {
      primaryIntent: "UNKNOWN",
      confidenceScore: 1.0,
      secondaryIntents: [],
    };
  }

  const aiEngine = await getAiEngine(workspaceId);

  const systemPrompt = `شما سیستم طبقه‌بندی هوشمند نیت کاربر (Intent Classifier) هستید.
دسته‌های مجاز:
- PRICING: استعلام قیمت، تعرفه
- PURCHASE: قصد خرید، ثبت سفارش
- COMPLAINT: شکایت، نارضایتی
- REFUND: عودت وجه، پس گرفتن پول
- GREETING: سلام و احوالپرسی
- SUPPORT: پشتیبانی عمومی
- TECHNICAL_ISSUE: مشکل فنی، باگ
- APPOINTMENT: رزرو وقت، زمان جلسه
- SALES: مشاوره فروش
- LEAD_QUALIFICATION: ارزیابی لید
- UNKNOWN: نامشخص

خروجی JSON:
{
  "primaryIntent": "PRICING",
  "confidenceScore": 0.95,
  "secondaryIntents": ["SALES"],
  "reasoning": "کاربر درباره قیمت محصول سوال کرده است."
}`;

  const completion = await aiEngine.generateCompletion({
    systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    jsonMode: true,
  });

  let result: IntentClassificationResult = {
    primaryIntent: "UNKNOWN",
    confidenceScore: 0.5,
    secondaryIntents: [],
  };

  try {
    const parsed = JSON.parse(completion.text);
    result = {
      primaryIntent: parsed.primaryIntent || "UNKNOWN",
      confidenceScore: parsed.confidenceScore || 0.8,
      secondaryIntents: parsed.secondaryIntents || [],
      reasoning: parsed.reasoning,
    };
  } catch {
    // Fallback
  }

  await prisma.aiAuditLog.create({
    data: {
      workspaceId,
      feature: "INTENT",
      provider: completion.provider,
      model: completion.model,
      promptTokens: completion.promptTokens,
      completionTokens: completion.completionTokens,
      latencyMs: completion.latencyMs,
      confidenceScore: result.confidenceScore,
      intentDetected: result.primaryIntent,
    },
  });

  return result;
}
