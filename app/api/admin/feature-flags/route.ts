import { NextResponse } from "next/server";
import { getCurrentWorkspaceId, getCurrentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { DEFAULT_FEATURE_CONFIGS, FeatureKey, setFeatureFlag } from "@/lib/flags/feature-flags";

const FEATURE_METADATA: Record<
  FeatureKey,
  { nameFa: string; nameEn: string; descFa: string; descEn: string; icon: string }
> = {
  SPIKE_BUFFER: {
    nameFa: "بافر هوشمند پیک ترافیک (Spike Buffer)",
    nameEn: "Spike Buffer",
    descFa: "مدیریت و دسته‌بندی کامنت‌ها و پیام‌های انبوه در زمان پیک ترافیک کمپین‌ها",
    descEn: "Batch and queue high volume incoming comments and DMs during peak traffic spikes.",
    icon: "⚡",
  },
  HUMAN_HANDOVER: {
    nameFa: "تحویل به اپراتور انسانی (Human Handover)",
    nameEn: "Human Handover",
    descFa: "توقف اتوماتیک ربات و ارجاع مکالمه به پشتیبان انسانی با کلمات «ادمین»، «پشتیبانی» و...",
    descEn: "Automatically pause bot and route conversation to human agent on keywords.",
    icon: "👤",
  },
  SMART_DELAY: {
    nameFa: "تاخیر هوشمند و طبیعی (Smart Delay)",
    nameEn: "Smart Delay",
    descFa: "ایجاد وقفه متغیر و طبیعی (۳ الی ۱۰ ثانیه) بین پیام‌ها برای شبیه‌سازی رفتار تایپ انسان",
    descEn: "Add natural randomized typing delays between direct messages to avoid anti-spam blocks.",
    icon: "⏳",
  },
  AI_COMPRESSION: {
    nameFa: "فشرده‌سازی حافظه هوش مصنوعی (AI Memory Compression)",
    nameEn: "AI Memory Compression",
    descFa: "تلخیص اتوماتیک تاریخچه مکالمات طولانی جهت بهینه‌سازی توکن و افزایش سرعت پاسخگویی",
    descEn: "Summarize long chat histories to optimize Gemini/AI token usage and latency.",
    icon: "🧠",
  },
  DEDUP: {
    nameFa: "جلوگیری از پاسخ تکراری (DEDUP Protection)",
    nameEn: "DEDUP Protection",
    descFa: "حذف پردازش‌های تکراری و جلوگیری از ارسال چندباره دایرکت به یک کامنت",
    descEn: "Prevent duplicate responses to the same comment or webhook payload within 24h.",
    icon: "🛡️",
  },
  DLQ: {
    nameFa: "صف پیام‌های شکست‌خورده (Dead Letter Queue - DLQ)",
    nameEn: "Dead Letter Queue",
    descFa: "ثبت و بازتلاش هوشمند پیام‌هایی که به دلیل قطعی شبکه اینستاگرام ارسال نشده‌اند",
    descEn: "Capture failed DM deliveries and retry automatically with backoff schedule.",
    icon: "🔄",
  },
  SMS_FALLBACK: {
    nameFa: "ارسال پیامک جایگزین (SMS Fallback)",
    nameEn: "SMS Fallback",
    descFa: "ارسال پیامک حاوی لینک/کد تخفیف در صورت مسدود بودن دایرکت مخاطب",
    descEn: "Fallback to SMS delivery if Instagram DM cannot be delivered to user.",
    icon: "💬",
  },
  FUNNEL: {
    nameFa: "ردیابی قیف تبدیل (Funnel Analytics)",
    nameEn: "Funnel Analytics",
    descFa: "ثبت گام به گام مراحل تعامل کاربران از کامنت تا ثبت ایمیل/شماره و خرید نهایی",
    descEn: "Track user stage progression from initial comment trigger to lead conversion.",
    icon: "📊",
  },
  GLASS_UI: {
    nameFa: "انیمیشن‌ها و افکت شیشه‌ای UI (Glassmorphism & Motion)",
    nameEn: "Glassmorphism UI",
    descFa: "فعال‌سازی افکت‌های بصری مدرن، شیشه‌ای و انیمیشن‌های سه‌بعدی پنل",
    descEn: "Enable dynamic modern glassmorphism aesthetics and micro-animations.",
    icon: "✨",
  },
};

export async function GET() {
  try {
    const workspaceId = await getCurrentWorkspaceId();

    const existingFlags = await prisma.systemFeatureFlag.findMany({
      where: {
        OR: [{ workspaceId: workspaceId || null }, { workspaceId: null }],
      },
    });

    const flagMap = new Map<string, any>();
    existingFlags.forEach((flag) => {
      flagMap.set(flag.featureKey, flag);
    });

    const flags = (Object.keys(DEFAULT_FEATURE_CONFIGS) as FeatureKey[]).map((key) => {
      const dbFlag = flagMap.get(key);
      const meta = FEATURE_METADATA[key] || {
        nameFa: key,
        nameEn: key,
        descFa: "",
        descEn: "",
        icon: "⚙️",
      };

      return {
        id: dbFlag?.id || key,
        key,
        nameFa: meta.nameFa,
        nameEn: meta.nameEn,
        descFa: meta.descFa,
        descEn: meta.descEn,
        icon: meta.icon,
        isEnabled: dbFlag ? dbFlag.isEnabled : DEFAULT_FEATURE_CONFIGS[key].isEnabled,
        config: dbFlag?.config
          ? { ...DEFAULT_FEATURE_CONFIGS[key].config, ...(dbFlag.config as any) }
          : DEFAULT_FEATURE_CONFIGS[key].config,
      };
    });

    return NextResponse.json({ success: true, flags, data: flags, featureFlags: flags });
  } catch (error: any) {
    console.error("[Feature Flags GET Error]:", error);
    return NextResponse.json({ error: error.message || "Failed to load feature flags" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const workspaceId = await getCurrentWorkspaceId();
    const body = await req.json();
    const { key, featureKey, id, isEnabled, config } = body;

    const targetKey = (key || featureKey || id) as FeatureKey;
    if (!targetKey) {
      return NextResponse.json({ error: "Feature key required" }, { status: 400 });
    }

    const flag = await setFeatureFlag(targetKey, Boolean(isEnabled), config, workspaceId || undefined);

    return NextResponse.json({ success: true, flag });
  } catch (error: any) {
    console.error("[Feature Flags POST Error]:", error);
    return NextResponse.json({ error: error.message || "Failed to save feature flag" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  return POST(req);
}
