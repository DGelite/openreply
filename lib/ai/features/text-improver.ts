import { getAiEngine } from "../factory";

export type TextImproverMode =
  | "PROFESSIONAL"
  | "FRIENDLY"
  | "SALES"
  | "FORMAL"
  | "SHORT"
  | "LONG"
  | "REWRITE"
  | "TRANSLATE";

export interface ImproveTextParams {
  workspaceId: string;
  text: string;
  mode: TextImproverMode;
  targetLanguage?: string;
}

const textImproverCache = new Map<string, { result: string; expiresAt: number }>();
const TEXT_IMPROVER_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function clearTextImproverCache(): void {
  textImproverCache.clear();
}

export async function improveText(
  params: ImproveTextParams
): Promise<string> {
  const { workspaceId, text, mode, targetLanguage = "Persian" } = params;

  if (!text || text.trim().length === 0) return "";

  const cacheKey = `${workspaceId}:${mode}:${targetLanguage}:${text.trim()}`;
  const now = Date.now();
  const cached = textImproverCache.get(cacheKey);
  if (cached && now < cached.expiresAt) {
    return cached.result;
  }

  const aiEngine = await getAiEngine(workspaceId);

  const modeInstructions: Record<TextImproverMode, string> = {
    PROFESSIONAL: "متن را حرفه‌ای، دقیق و اداری بازنویسی کن.",
    FRIENDLY: "متن را صمیمی، دوستانه و جذاب بازنویسی کن.",
    SALES: "متن را متقاعدکننده، جذاب و مناسب فروش بازنویسی کن.",
    FORMAL: "متن را کاملاً رسمی و با احترام بازنویسی کن.",
    SHORT: "متن را خلاصه، فشرده و کوتاه کن.",
    LONG: "متن را بازتر، کامل‌تر و با جزئیات بیشتر بنویس.",
    REWRITE: "متن را با جمله‌بندی روان‌تر و جدید بازنویسی کن.",
    TRANSLATE: `متن را روان و دقیق به زبان ${targetLanguage} ترجمه کن.`,
  };

  const systemPrompt = `شما متخصص ویرایش متن برای پلتفرم اینستاگرام و چت‌بات‌ها هستید.
قوانین بسیار مهم:
۱. تمام ایموجی‌های موجود در متن اصلی را حفظ کن.
۲. تمام متغیرها (مانند {username}، {link}، {coupon}) را دقیقاً بدون تغییر در متن نگه دار.
۳. فرمت‌بندی متن را حفظ کن.
۴. ${modeInstructions[mode] || "متن را روان‌تر بازنویسی کن."}

فقط و فقط متن بهبودیافته نهایی را برگردان، بدون توضیحات اضافی.`;

  const completion = await aiEngine.generateCompletion({
    systemPrompt,
    messages: [{ role: "user", content: text }],
    temperature: 0.5,
  });

  const result = completion.text.trim();
  textImproverCache.set(cacheKey, { result, expiresAt: now + TEXT_IMPROVER_CACHE_TTL_MS });

  return result;
}
