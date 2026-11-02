/**
 * OpenReply Business AI Persona Engine
 * Crafts customized, sharp, conversational business mentor prompts based on business settings.
 * Strictly adheres to persona guidelines:
 * - Conversational & Simple Persian (عامانه، صمیمی، بی‌تکلف)
 * - Zero Guru / Author name dropping
 * - Strictly forbidden military slop (فرمانده، امپراتوری، اتاق جنگ)
 * - Objection handling & human escalation protocols
 */

export interface PersonaConfig {
  assistantName?: string | null;
  roleTitle?: string | null;
  businessType?: string | null;
  targetAudience?: string | null;
  personalityDemeanor?: string | null;
  defaultTone?: string | null;
  preferredWords?: string[];
  forbiddenWords?: string[];
  unhappyClientPolicy?: string | null;
  priceObjectionPolicy?: string | null;
  hesitantClientPolicy?: string | null;
  humanEscalationTriggers?: string[];
}

const GLOBAL_FORBIDDEN_WORDS = [
  "فرمانده",
  "امپراتوری",
  "سرباز",
  "مهمات",
  "اتاق جنگ",
  "ضدگلوله",
  "داور بی‌رحم",
  "قرارداد مرگ و زندگی",
  "الکس هرموزی",
  "هرموزی",
  "راسل برانسون",
];

export function buildBusinessPersonaPrompt(config: PersonaConfig): string {
  const name = config.assistantName || "مشاور فروش";
  const role = config.roleTitle || "مشاور فروش و پشتیبانی";
  const business = config.businessType || "کسب‌وکار و خدمات";
  const audience = config.targetAudience || "مشتریان و متقاضیان خدمات";
  const tone = config.defaultTone || "صمیمی، محترمانه و خودمانی";

  const customForbidden = Array.isArray(config.forbiddenWords) ? config.forbiddenWords : [];
  const allForbidden = Array.from(new Set([...GLOBAL_FORBIDDEN_WORDS, ...customForbidden]));

  const sections: string[] = [
    `تو «${name}»، ${role} در حوزه «${business}» هستی. مخاطبان تو «${audience}» هستند.`,
    `لحن تو: ${tone}. همیشه به زبان فارسی روان، عامیانه، صمیمی، بی‌تکلف و کاملاً محترمانه صحبت کن.`,
    `اصول پاسخگویی:`,
    `- بسیار کوتاه، شفاف و مستقیم پاسخ بده (حداکثر ۲ تا ۳ جمله). از جملات کلیشه‌ای و تشریفات زائد خودداری کن.`,
    `- هرگز ادعای کذب درباره محصول، قیمت یا شرایط نکن. اگر اطلاعاتی در دانش کسب‌وکار نبود، صادقانه بگو اطلاعی نداری و پیشنهاد کن به اپراتور وصل شود.`,
    `- واژگان کاملاً ممنوع (هرگز استفاده نکن): ${allForbidden.join("، ")}.`,
  ];

  if (config.unhappyClientPolicy) {
    sections.push(`برخورد با مشتری ناراضی: ${config.unhappyClientPolicy}`);
  } else {
    sections.push(`برخورد با مشتری ناراضی: اول با آرامش و احترام کامل مشکل را بشنو، همدردی کن و برای پیگیری دقیق به پشتیبان انسانی وصل کن. هرگز در زمان نارضایتی پیشنهاد خرید نده.`);
  }

  if (config.priceObjectionPolicy) {
    sections.push(`پاسخ به اعتراض قیمت: ${config.priceObjectionPolicy}`);
  } else {
    sections.push(`پاسخ به اعتراض قیمت: ارزش و خروجی واقعی کار را با اعداد شفاف توضیح بده و در صورت تمایل او را به مشاوره دعوت کن.`);
  }

  if (config.hesitantClientPolicy) {
    sections.push(`پاسخ به مشتری مردد: ${config.hesitantClientPolicy}`);
  }

  if (Array.isArray(config.preferredWords) && config.preferredWords.length > 0) {
    sections.push(`واژگان و اصطلاحات ترجیحی: ${config.preferredWords.join("، ")}.`);
  }

  if (Array.isArray(config.humanEscalationTriggers) && config.humanEscalationTriggers.length > 0) {
    sections.push(`موارد ارجاع به اپراتور انسانی: ${config.humanEscalationTriggers.join("، ")}.`);
  }

  return sections.join("\n");
}
