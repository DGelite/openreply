import { prisma } from "@/lib/db/client";
import { getAiEngine } from "../factory";
import { normalizePersian } from "@/lib/utils/keyword-matcher";

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

const intentCache = new Map<string, { result: IntentClassificationResult; expiresAt: number }>();
const INTENT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_INTENT_CACHE_SIZE = 200;

export function clearIntentCache(): void {
  intentCache.clear();
}

/**
 * Fast deterministic heuristics before making an LLM API call.
 * Saves 100% tokens and latency on standard obvious messages.
 */
function checkDeterministicIntent(cleanText: string): IntentClassificationResult | null {
  const normalized = normalizePersian(cleanText).toLowerCase().trim();
  const t = normalized.replace(/\s+/g, " ");

  // 1. Simple Greetings
  const greetingWords = ["سلام", "درود", "صبح بخیر", "عصر بخیر", "شب بخیر", "وقت بخیر", "خسته نباشید", "hi", "hello", "hey"];
  if (greetingWords.includes(t) || (t.startsWith("سلام") && t.length <= 15)) {
    return {
      primaryIntent: "GREETING",
      confidenceScore: 1.0,
      secondaryIntents: [],
      reasoning: "Rule engine: Exact greeting match",
    };
  }

  // 2. Direct Pricing Inquiries
  const pricingWords = ["قیمت", "چنده", "هزینه", "تعرفه", "چقدر میشه", "قیمتش چنده", "قیمت چنده", "price", "cost"];
  if (pricingWords.some((w) => t === w || (t.includes(w) && t.length <= 25))) {
    return {
      primaryIntent: "PRICING",
      confidenceScore: 0.95,
      secondaryIntents: ["SALES"],
      reasoning: "Rule engine: Direct pricing keyword match",
    };
  }

  // 3. Direct Appointment Inquiries
  const appointmentWords = ["رزرو", "نوبت", "رزرو نوبت", "وقت مشاوره", "appointment", "booking"];
  if (appointmentWords.some((w) => t === w || (t.includes(w) && t.length <= 25))) {
    return {
      primaryIntent: "APPOINTMENT",
      confidenceScore: 0.95,
      secondaryIntents: ["SALES"],
      reasoning: "Rule engine: Direct booking keyword match",
    };
  }

  return null;
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

  const cleanMessage = userMessage.trim();

  // 1. Rule engine fast-path
  const ruleMatch = checkDeterministicIntent(cleanMessage);
  if (ruleMatch) {
    return ruleMatch;
  }

  // 2. In-memory cache check
  const normalizedKey = normalizePersian(cleanMessage).toLowerCase().trim();
  const cacheKey = `${workspaceId}:${normalizedKey}`;
  const now = Date.now();
  const cached = intentCache.get(cacheKey);
  if (cached) {
    if (now < cached.expiresAt) {
      return cached.result;
    }
    intentCache.delete(cacheKey);
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

  // Cache result for repeated identical questions
  if (intentCache.size >= MAX_INTENT_CACHE_SIZE) {
    const oldest = intentCache.keys().next().value;
    if (oldest) intentCache.delete(oldest);
  }
  intentCache.set(cacheKey, { result, expiresAt: now + INTENT_CACHE_TTL_MS });

  // Fire-and-forget audit log (never block the response)
  prisma.aiAuditLog.create({
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
  }).catch(() => {});

  return result;
}
