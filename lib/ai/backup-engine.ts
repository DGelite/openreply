import { normalizeNumerals } from "./phone-extractor";
import { normalizePersian } from "@/lib/utils/keyword-matcher";
import type { IntentCategory, IntentClassificationResult } from "./features/intent-recognition";

/**
 * Verifies that an extracted/AI-returned phone number is strictly grounded
 * in the user's raw message digits so an LLM can NEVER alter or hallucinate digits.
 */
export function isPhoneGroundedInInput(candidatePhone: string, rawInput: string): boolean {
  if (!candidatePhone || !rawInput) return false;

  const rawNormalized = normalizeNumerals(rawInput);
  const rawDigits = rawNormalized.replace(/\D/g, "");
  const phoneDigits = normalizeNumerals(candidatePhone).replace(/\D/g, "");

  if (phoneDigits.length < 10 || rawDigits.length < 10) {
    return false;
  }

  // Exact full digit sequence present in user message
  if (rawDigits.includes(phoneDigits)) {
    return true;
  }

  // Canonical 10-digit Iranian mobile core (9xxxxxxxxx), accounting for 0 / 98 / +98 / 0098 prefixes
  if (phoneDigits.length === 11 && phoneDigits.startsWith("09")) {
    const core10 = phoneDigits.slice(1);
    return rawDigits.includes(core10);
  }
  if (phoneDigits.length === 12 && phoneDigits.startsWith("989")) {
    const core10 = phoneDigits.slice(2);
    return rawDigits.includes(core10);
  }

  return false;
}

/**
 * Extended deterministic intent classifier used both as a backup when AI providers fail
 * and for reliable intent routing.
 */
export function classifyBackupIntent(cleanText: string): IntentClassificationResult {
  const normalized = normalizePersian(cleanText || "").toLowerCase().trim();
  const t = normalized.replace(/\s+/g, " ");

  if (!t) {
    return {
      primaryIntent: "UNKNOWN",
      confidenceScore: 1.0,
      secondaryIntents: [],
      reasoning: "Backup engine: Empty input",
    };
  }

  const containsAny = (words: string[]) => words.some((w) => t.includes(w));

  if (containsAny(["مرجوع", "بازگشت وجه", "پس بفرست", "عودت", "پولم رو", "refund", "money back"])) {
    return {
      primaryIntent: "REFUND",
      confidenceScore: 0.85,
      secondaryIntents: ["COMPLAINT"],
      reasoning: "Backup engine: Refund keyword match",
    };
  }

  if (containsAny(["شکایت", "کلاهبرداری", "ناراضی", "افتضاح", "خراب", "بد بود", "جواب نمیدید", "complaint"])) {
    return {
      primaryIntent: "COMPLAINT",
      confidenceScore: 0.85,
      secondaryIntents: ["SUPPORT"],
      reasoning: "Backup engine: Complaint keyword match",
    };
  }

  if (containsAny(["قیمت", "هزینه", "تعرفه", "چنده", "چقدر", "مبلغ", "تومان", "تومن", "price", "cost"])) {
    return {
      primaryIntent: "PRICING",
      confidenceScore: 0.9,
      secondaryIntents: ["SALES"],
      reasoning: "Backup engine: Pricing keyword match",
    };
  }

  if (containsAny(["خرید", "سفارش", "ثبت نام", "ثبت‌نام", "تهیه", "لینک پرداخت", "شماره کارت", "buy", "order"])) {
    return {
      primaryIntent: "PURCHASE",
      confidenceScore: 0.88,
      secondaryIntents: ["SALES"],
      reasoning: "Backup engine: Purchase keyword match",
    };
  }

  if (containsAny(["رزرو", "نوبت", "مشاوره", "جلسه", "تایم", "ساعت", "appointment", "booking"])) {
    return {
      primaryIntent: "APPOINTMENT",
      confidenceScore: 0.88,
      secondaryIntents: ["SALES"],
      reasoning: "Backup engine: Appointment keyword match",
    };
  }

  if (containsAny(["ارور", "خطا", "باز نمیشه", "کار نمیکنه", "لینک خراب", "مشكله", "باگ", "bug", "error"])) {
    return {
      primaryIntent: "TECHNICAL_ISSUE",
      confidenceScore: 0.82,
      secondaryIntents: ["SUPPORT"],
      reasoning: "Backup engine: Technical issue keyword match",
    };
  }

  if (containsAny(["سلام", "درود", "صبح بخیر", "عصر بخیر", "شب بخیر", "وقت بخیر", "خسته نباشید", "hi", "hello", "hey"])) {
    return {
      primaryIntent: "GREETING",
      confidenceScore: 0.9,
      secondaryIntents: [],
      reasoning: "Backup engine: Greeting keyword match",
    };
  }

  if (containsAny(["راهنما", "پشتیبان", "سوال", "چطوری", "چطور", "توضیح", "کمک", "support", "help"])) {
    return {
      primaryIntent: "SUPPORT",
      confidenceScore: 0.78,
      secondaryIntents: [],
      reasoning: "Backup engine: Support keyword match",
    };
  }

  const secondary: IntentCategory[] = [];
  return {
    primaryIntent: "UNKNOWN",
    confidenceScore: 0.5,
    secondaryIntents: secondary,
    reasoning: "Backup engine: General message fallback",
  };
}

/**
 * Deterministic backup comment analyzer & responder when AI providers are unavailable.
 */
export function buildBackupCommentReply(
  commentText: string,
  manualApprovalMode = false
): {
  replyText: string;
  isSpam: boolean;
  confidenceScore: number;
  requiresManualApproval: boolean;
  shouldSkip: boolean;
} {
  const normalized = normalizePersian(commentText || "").trim();
  if (!normalized || normalized.length < 2) {
    return {
      replyText: "",
      isSpam: true,
      confidenceScore: 0.9,
      requiresManualApproval: false,
      shouldSkip: true,
    };
  }

  const spamPatterns = ["فالوور ارزان", "کلیک کن", "کسب درآمد تضمینی", "http://", "https://", "t.me/"];
  if (spamPatterns.some((p) => normalized.toLowerCase().includes(p))) {
    return {
      replyText: "",
      isSpam: true,
      confidenceScore: 0.95,
      requiresManualApproval: false,
      shouldSkip: true,
    };
  }

  const intent = classifyBackupIntent(normalized);
  let replyText = "مرسی از همراهیتون! 🙏 اگر سوالی داشتید دایرکت در خدمتیم.";

  switch (intent.primaryIntent) {
    case "PRICING":
    case "PURCHASE":
    case "APPOINTMENT":
      replyText = "ممنون از پیام‌تون! 🙏 جزئیات رو براتون دایرکت می‌کنیم، لطفاً پیام‌ها رو چک کنید.";
      break;
    case "GREETING":
      replyText = "سلام و درود به شما! خوشحالیم همراه ما هستید 🙏";
      break;
    case "COMPLAINT":
    case "REFUND":
    case "TECHNICAL_ISSUE":
      replyText = "ممنون که اطلاع دادید 🙏 لطفاً توی دایرکت پیام بدید تا سریع بررسی کنیم.";
      break;
    default:
      replyText = "مرسی از کامنت قشنگتون! ❤️ سوالی داشتید توی دایرکت بپرسید.";
  }

  return {
    replyText,
    isSpam: false,
    confidenceScore: 0.72,
    requiresManualApproval: manualApprovalMode,
    shouldSkip: false,
  };
}

const FORBIDDEN_PERSONA_WORDS_RE =
  /(فرمانده|امپراتوری|سرباز|مهمات|اتاق جنگ|ضدگلوله|داور بی‌رحم|قرارداد مرگ و زندگی|الکس هرموزی|راسل برانسون)/gi;

/**
 * Deterministic backup responder for DMs & RAG smart replies when LLM APIs are unavailable.
 */
export function buildBackupSmartResponse(params: {
  userMessage: string;
  customerName?: string | null;
  hasPhone?: boolean;
  kbSnippets?: string[];
  offlineMessage?: string | null;
}): string {
  const { userMessage, customerName, hasPhone, kbSnippets = [], offlineMessage } = params;

  const greetingName = customerName ? ` ${customerName} جان` : "";

  // 1. If Knowledge Base / FAQ already matched something concrete, return a clean concise answer
  const topSnippet = kbSnippets.find((s) => Boolean(s && s.trim().length > 0))?.trim();
  if (topSnippet) {
    const cleanSnippet = topSnippet
      .replace(FORBIDDEN_PERSONA_WORDS_RE, "")
      .trim()
      .slice(0, 320);
    if (cleanSnippet.length >= 10) {
      return `سلام${greetingName}! 🙏\n${cleanSnippet}\n\nاگر سوال دیگه‌ای دارید یا می‌خواید هماهنگ کنیم بفرمایید.`;
    }
  }

  // 2. Use workspace offline message if explicitly configured
  if (offlineMessage && offlineMessage.trim().length >= 5) {
    return offlineMessage.replace(FORBIDDEN_PERSONA_WORDS_RE, "").trim();
  }

  // 3. Intent-based polite Persian backup reply
  const intent = classifyBackupIntent(userMessage);
  switch (intent.primaryIntent) {
    case "GREETING":
      return `سلام${greetingName}! خوش اومدید 🙏 چطور می‌تونم راهنماییتون کنم؟`;

    case "PRICING":
      return hasPhone
        ? `ممنون${greetingName} بابت پیامتون 🙏 جزئیات قیمت و شرایط رو همکارانمون خیلی زود براتون ارسال می‌کنن.`
        : `سلام${greetingName}! برای اینکه تعرفه دقیق و راهنمایی متناسب با کارتون رو بفرستیم، لطفاً شماره‌تون رو بفرستید یا بفرمایید دقیقاً کدوم مورد رو می‌خواید 🙏`;

    case "APPOINTMENT":
    case "PURCHASE":
      return hasPhone
        ? `عالیه${greetingName}! شماره‌تون ثبت شده و تیم ما برای هماهنگی و ثبت نهایی خیلی زود باهاتون تماس می‌گیره 🙏`
        : `برای هماهنگی و ثبت نهایی، لطفاً اسم و شماره تماستون رو بفرستید تا همکارانمون سریع پیگیری کنن 🙏`;

    case "COMPLAINT":
    case "REFUND":
    case "TECHNICAL_ISSUE":
      return `عذرخواهی می‌کنم بابت مشکل پیش‌اومده${greetingName} 🙏 پیامتون رو ثبت کردیم و تیم پشتیبانی در اولین فرصت بررسی و باهاتون هماهنگ می‌کنه.`;

    default:
      return hasPhone
        ? `ممنون از پیامتون${greetingName} 🙏 پیامتون ثبت شد و همکارانمون خیلی زود پاسخ دقیق رو براتون ارسال می‌کنن.`
        : `ممنون از پیامتون${greetingName} 🙏 سوالتون رو کامل‌تر بفرمایید یا اگر مایلید شماره تماستون رو بگذارید تا راهنماییتون کنیم.`;
  }
}
