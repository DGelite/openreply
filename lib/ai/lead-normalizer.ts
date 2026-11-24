import { prisma } from "@/lib/db/client";
import { getAiEngine } from "./factory";
import { extractPhoneNumber } from "./phone-extractor";

export interface NormalizeLeadOptions {
  workspaceId: string;
  userMessage: string;
  expectedField: "name" | "phone" | "both" | "text";
  currentLead?: {
    name?: string | null;
    phone?: string | null;
    notes?: string | null;
  };
  customPrompt?: string | null;
  mode?: "SILENT_NORMALIZE_ONLY" | "ASSISTANT_CO_PILOT";
}

export interface NormalizedLeadResult {
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  phone: string | null;
  notes: string | null;
  replyMessageToUser: string | null;
  normalizedByAi: boolean;
  fastPath: boolean;
  confidence: number;
}

const DEFAULT_NORMALIZER_PROMPT = `تو یک نرمال‌ساز داده‌های تجاری اینستاگرام برای سیستم CRM هستی.
وظیفه تو فقط و فقط استخراج داده‌های ساختاریافته مشتری (نام، نام خانوادگی، شماره موبایل، یادداشت/سوالات مشتری) از پیام دایرکت است.

قوانین استخراج:
1. نام و نام خانوادگی را از تعارفات و مقدمه‌ها (سلام، درود، من هستم، اسمم، و...) جدا کن.
2. فامیلی‌های چندکلمه‌ای (مثل طهماسبی فرد، حسینی نژاد) را به عنوان نام خانوادگی در نظر بگیر.
3. شماره موبایل را به فرمت استاندارد 09xxxxxxxxx تبدیل کن (تبدیل اعداد فارسی به انگلیسی).
4. هر توضیح اضافه، سوال درباره خدمات/قیمت، ساعت تماس مناسب، یا نیازهای خاص مشتری را در فیلد notes بنویس.
5. اگر mode برابر "ASSISTANT_CO_PILOT" بود و کاربر سوالی پرسیده بود، یک پاسخ بسیار کوتاه، محترمانه و دقیق (حداکثر ۱ جمله) در فیلد questionAnswer بده. در غیر این صورت questionAnswer باید null باشد.
6. خروجی باید فقط و فقط یک آبجکت JSON معتبر و بدون هیچ متن اضافه یا markdown باشد.

فرمت خروجی JSON:
{
  "firstName": "string or null",
  "lastName": "string or null",
  "phone": "string or null",
  "notes": "string or null",
  "questionAnswer": "string or null"
}`;

/**
 * Checks if input is already clean and can be fast-pathed with 0 tokens and 0ms latency.
 */
function tryFastPath(
  text: string,
  expectedField: "name" | "phone" | "both" | "text"
): NormalizedLeadResult | null {
  const clean = text.trim();

  // Fast-path for Name: 2 or 3 Persian words with no conversational noise
  if (expectedField === "name") {
    const isOnlyPersianLetters = /^[\u0600-\u06FF\s]+$/.test(clean);
    const words = clean.split(/\s+/).filter(Boolean);
    const fillerWords = [
      "سلام", "درود", "هستم", "اسمم", "من", "نام", "خسته", "نباشید", "چنده", "قیمت", "چطوری", "میخواستم", "لطفا", "تماس"
    ];
    const hasFiller = words.some((w) => fillerWords.includes(w));

    if (isOnlyPersianLetters && words.length >= 2 && words.length <= 4 && !hasFiller && clean.length <= 40) {
      const firstName = words[0];
      const lastName = words.slice(1).join(" ");
      return {
        firstName,
        lastName,
        fullName: clean,
        phone: null,
        notes: null,
        replyMessageToUser: null,
        normalizedByAi: false,
        fastPath: true,
        confidence: 1.0,
      };
    }
  }

  // Fast-path for Phone: clean phone number with no extra words
  if (expectedField === "phone") {
    const extraction = extractPhoneNumber({ messageText: clean });
    if (extraction.detected && extraction.phoneNumber) {
      // If message is practically just the phone number (length <= 20)
      const digitsOnly = clean.replace(/[^0-9\u06F0-\u06F9]/g, "");
      if (digitsOnly.length >= 10 && clean.length <= 20) {
        return {
          firstName: null,
          lastName: null,
          fullName: null,
          phone: extraction.phoneNumber,
          notes: null,
          replyMessageToUser: null,
          normalizedByAi: false,
          fastPath: true,
          confidence: 1.0,
        };
      }
    }
  }

  return null;
}

/**
 * Normalizes lead data using Fast-Path or AI with complete fallback resilience.
 * CRITICAL INVARIANT: NEVER throws an error to the user or breaks the DM flow.
 */
export async function normalizeLeadData(
  options: NormalizeLeadOptions
): Promise<NormalizedLeadResult> {
  const {
    workspaceId,
    userMessage,
    expectedField,
    currentLead,
    customPrompt,
    mode = "SILENT_NORMALIZE_ONLY",
  } = options;

  const rawClean = (userMessage || "").trim();
  if (!rawClean) {
    return {
      firstName: null,
      lastName: null,
      fullName: null,
      phone: null,
      notes: null,
      replyMessageToUser: null,
      normalizedByAi: false,
      fastPath: true,
      confidence: 0,
    };
  }

  // 1. Try Zero-Token Fast Path
  const fastPathResult = tryFastPath(rawClean, expectedField);
  if (fastPathResult) {
    return fastPathResult;
  }

  // 2. Fetch AI Config for Workspace
  let aiConfig: any = null;
  try {
    aiConfig = await prisma.aiConfig.findUnique({
      where: { workspaceId },
      select: { isEnabled: true, systemPrompt: true, safetySettings: true },
    });
  } catch (err) {
    console.error("[LeadNormalizer] Error fetching AiConfig:", err);
  }

  const leadNorm = (aiConfig?.safetySettings as any)?.leadNormalizer || {};
  const isNormalizerEnabled = leadNorm.enabled ?? aiConfig?.isEnabled ?? true;

  // If normalizer or AI is disabled, execute safe heuristic fallback
  if (!isNormalizerEnabled || (aiConfig && !aiConfig.isEnabled)) {
    return fallbackRegexExtraction(rawClean, expectedField);
  }

  const effectiveMode = leadNorm.mode || mode || "SILENT_NORMALIZE_ONLY";
  const effectivePrompt = leadNorm.prompt || customPrompt || DEFAULT_NORMALIZER_PROMPT;

  // 3. AI Execution with Graceful Failure Protection
  try {
    const aiEngine = await getAiEngine(workspaceId);

    const userPrompt = `متن پیام کاربر در دایرکت:
"""${rawClean}"""

فیلد مورد انتظار فرم: ${expectedField}
حالت اجرا: ${effectiveMode}
اطلاعات قبلی ثبت شده از لید: ${JSON.stringify(currentLead || {})}

اطلاعات استخراج شده را در قالب فرمت JSON مشخص شده تحویل بده:`;

    const completion = await aiEngine.generateCompletion({
      messages: [{ role: "user", content: userPrompt }],
      systemPrompt: effectivePrompt,
      temperature: 0.1, // Deterministic extraction
      maxTokens: 300,
      jsonMode: true,
    });

    const parsed = parseJsonSafely(completion.text);
    if (!parsed) {
      console.warn("[LeadNormalizer] AI returned invalid JSON:", completion.text);
      return fallbackRegexExtraction(rawClean, expectedField);
    }

    const firstName = parsed.firstName ? String(parsed.firstName).trim() : null;
    const lastName = parsed.lastName ? String(parsed.lastName).trim() : null;
    const fullName = firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || null;

    let phone = parsed.phone ? String(parsed.phone).trim() : null;
    if (phone) {
      const validatedPhone = extractPhoneNumber({ messageText: phone });
      if (validatedPhone.detected && validatedPhone.phoneNumber) {
        phone = validatedPhone.phoneNumber;
      }
    } else {
      // In case AI missed inline phone, run regex extractor as safety net
      const fallbackPhone = extractPhoneNumber({ messageText: rawClean });
      if (fallbackPhone.detected && fallbackPhone.phoneNumber) {
        phone = fallbackPhone.phoneNumber;
      }
    }

    const notes = parsed.notes ? String(parsed.notes).trim() : null;
    const replyMessageToUser =
      mode === "ASSISTANT_CO_PILOT" && parsed.questionAnswer
        ? String(parsed.questionAnswer).trim()
        : null;

    return {
      firstName,
      lastName,
      fullName,
      phone,
      notes,
      replyMessageToUser,
      normalizedByAi: true,
      fastPath: false,
      confidence: 0.95,
    };
  } catch (err) {
    // CRITICAL: Log error internally, NEVER leak to user
    console.error("[LeadNormalizer] AI execution failed, falling back to heuristic extraction:", err);
    return fallbackRegexExtraction(rawClean, expectedField);
  }
}

/**
 * Safe heuristic fallback when AI is unavailable or encounters errors.
 * Ensures data is still extracted without throwing or interrupting the user.
 */
function fallbackRegexExtraction(
  text: string,
  expectedField: "name" | "phone" | "both" | "text"
): NormalizedLeadResult {
  const phoneRes = extractPhoneNumber({ messageText: text });
  const phone = phoneRes.detected && phoneRes.phoneNumber ? phoneRes.phoneNumber : null;

  // Clean conversational prefixes and greetings in a loop to handle compound greetings (e.g. "سلام روزتون بخیر من...")
  let cleanedName = text.trim();
  let prev = "";
  while (prev !== cleanedName) {
    prev = cleanedName;
    cleanedName = cleanedName
      .replace(/^(سلام|درود|صبح\s*بخیر|عصر\s*بخیر|شب\s*بخیر|وقت\s*(?:تون|تونم)?\s*بخیر|روز\s*(?:تون|تونم)?\s*بخیر|خسته\s*نباشید)[\s،,.]*/gi, "")
      .replace(/^(من|اسمم|نام من|نامم|منم|بنده)[\s:]*/gi, "")
      .trim();
  }

  // Strip trailing predicates and following intent/clauses (e.g. "هستم میخواستم ثبت نام کنم")
  cleanedName = cleanedName
    .replace(/\s*(?:هستم|می‌باشم|هستم\.)[\s\S]*$/gi, "")
    .replace(/\s*(?:میخواستم|میخوام|برای|جهت|ثبت\s*نام|تماس)[\s\S]*$/gi, "")
    .trim();

  // Strip phone number from name if user included both
  if (phone) {
    cleanedName = cleanedName.replace(/(?:(?:\+|00)?98|0)?9\d{9}/g, "").trim();
  }

  // Remove question clauses
  const questionSplit = cleanedName.split(/[؟?]/)[0].trim();
  if (questionSplit.length >= 2) {
    cleanedName = questionSplit;
  }

  const words = cleanedName.split(/\s+/).filter(Boolean);
  const firstName = words[0] || null;
  const lastName = words.slice(1).join(" ") || null;
  const fullName = words.length > 0 ? words.join(" ") : null;

  return {
    firstName: expectedField === "phone" ? null : firstName,
    lastName: expectedField === "phone" ? null : lastName,
    fullName: expectedField === "phone" ? null : fullName,
    phone,
    notes: text.length > 40 ? text : null,
    replyMessageToUser: null,
    normalizedByAi: false,
    fastPath: false,
    confidence: 0.6,
  };
}

function parseJsonSafely(raw: string): Record<string, unknown> | null {
  try {
    const clean = raw.replace(/```json\s*/gi, "").replace(/```\s*$/gi, "").trim();
    return JSON.parse(clean);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}
