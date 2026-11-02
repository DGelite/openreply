"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/context/language-context";

interface AiPersonaData {
  isEnabled: boolean;
  provider: string;
  assistantName: string | null;
  roleTitle: string | null;
  businessType: string | null;
  targetAudience: string | null;
  personalityDemeanor: string | null;
  defaultTone: string;
  preferredWords: string[];
  forbiddenWords: string[];
  unhappyClientPolicy: string | null;
  priceObjectionPolicy: string | null;
  hesitantClientPolicy: string | null;
  humanEscalationTriggers: string[];
  primaryGoal: "LEAD_GENERATION" | "APPOINTMENT_BOOKING" | "PRODUCT_SALES" | "SUPPORT_RESOLUTION";
}

export function AiPersonaCard() {
  const { language } = useLanguage();
  const isFa = language === "fa";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [assistantName, setAssistantName] = useState("مشاور فروش");
  const [roleTitle, setRoleTitle] = useState("مشاور ارشد و پشتیبان");
  const [businessType, setBusinessType] = useState("کسب‌وکار و آموزش دیجیتال");
  const [targetAudience, setTargetAudience] = useState("مشتریان و متقاضیان");
  const [personalityDemeanor, setPersonalityDemeanor] = useState("حرفه‌ای، صمیمی، موجز و بدون مبالغه");
  const [primaryGoal, setPrimaryGoal] = useState<"LEAD_GENERATION" | "APPOINTMENT_BOOKING" | "PRODUCT_SALES" | "SUPPORT_RESOLUTION">("LEAD_GENERATION");
  const [preferredWordsStr, setPreferredWordsStr] = useState("");
  const [forbiddenWordsStr, setForbiddenWordsStr] = useState("");
  const [unhappyPolicy, setUnhappyPolicy] = useState("");
  const [priceObjectionPolicy, setPriceObjectionPolicy] = useState("");
  const [hesitantPolicy, setHesitantPolicy] = useState("");
  const [escalationTriggersStr, setEscalationTriggersStr] = useState("");

  useEffect(() => {
    fetch("/api/admin/ai-config")
      .then((res) => res.json())
      .then((payload) => {
        if (payload.success && payload.data) {
          const d: AiPersonaData = payload.data;
          setAssistantName(d.assistantName || "مشاور فروش");
          setRoleTitle(d.roleTitle || "مشاور ارشد و پشتیبان");
          setBusinessType(d.businessType || "کسب‌وکار و آموزش دیجیتال");
          setTargetAudience(d.targetAudience || "مشتریان و متقاضیان");
          setPersonalityDemeanor(d.personalityDemeanor || "حرفه‌ای، صمیمی، موجز و بدون مبالغه");
          setPrimaryGoal(d.primaryGoal || "LEAD_GENERATION");
          setPreferredWordsStr(Array.isArray(d.preferredWords) ? d.preferredWords.join("، ") : "");
          setForbiddenWordsStr(Array.isArray(d.forbiddenWords) ? d.forbiddenWords.join("، ") : "");
          setUnhappyPolicy(d.unhappyClientPolicy || "");
          setPriceObjectionPolicy(d.priceObjectionPolicy || "");
          setHesitantPolicy(d.hesitantClientPolicy || "");
          setEscalationTriggersStr(Array.isArray(d.humanEscalationTriggers) ? d.humanEscalationTriggers.join("، ") : "");
        }
      })
      .catch((err) => console.error("Failed to load AI persona config:", err))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const parseList = (str: string) =>
      str
        .split(/[،,]/)
        .map((s) => s.trim())
        .filter(Boolean);

    try {
      const res = await fetch("/api/admin/ai-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assistantName,
          roleTitle,
          businessType,
          targetAudience,
          personalityDemeanor,
          primaryGoal,
          preferredWords: parseList(preferredWordsStr),
          forbiddenWords: parseList(forbiddenWordsStr),
          unhappyClientPolicy: unhappyPolicy,
          priceObjectionPolicy,
          hesitantClientPolicy: hesitantPolicy,
          humanEscalationTriggers: parseList(escalationTriggersStr),
        }),
      });

      const payload = await res.json();
      if (payload.success) {
        setMessage({
          type: "success",
          text: isFa ? "✅ شخصیت و سیاست‌های هوش مصنوعی با موفقیت به‌روزرسانی شد." : "AI Persona & policies updated successfully.",
        });
      } else {
        setMessage({
          type: "error",
          text: payload.error || (isFa ? "خطا در ذخیره تنظیمات" : "Failed to save settings"),
        });
      }
    } catch {
      setMessage({
        type: "error",
        text: isFa ? "خطای شبکه در ارتباط با سرور" : "Network error saving settings",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="panel rounded p-6 animate-pulse h-48 bg-surface/50" />;
  }

  return (
    <section className="panel rounded p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {isFa ? "شخصیت و سیاست‌های هوش مصنوعی (AI Persona & Strategy)" : "AI Persona & Funnel Strategy"}
          </h2>
          <p className="text-xs text-muted mt-1">
            {isFa
              ? "تعیین لحن، هویت، اهداف مکالمه، رفع اعتراض مشتری و خطوط قرمز پاسخگویی به دایرکت‌ها"
              : "Define brand voice, target audience, conversation goals, and objection policies."}
          </p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded bg-accent/10 text-accent font-medium">
          {primaryGoal === "LEAD_GENERATION"
            ? (isFa ? "هدف: جذب لید و شماره" : "Goal: Lead Gen")
            : primaryGoal === "APPOINTMENT_BOOKING"
            ? (isFa ? "هدف: رزرو نوبت" : "Goal: Booking")
            : (isFa ? "هدف: فروش مستقیم" : "Goal: Direct Sale")}
        </span>
      </div>

      {message && (
        <div
          className={`p-3 rounded mb-4 text-xs font-medium ${
            message.type === "success"
              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
              : "bg-red-500/10 text-red-600 border border-red-500/20"
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              {isFa ? "نام دستیار هوشمند" : "Assistant Name"}
            </label>
            <input
              type="text"
              value={assistantName}
              onChange={(e) => setAssistantName(e.target.value)}
              placeholder="مثلاً: سارا"
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent/40"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              {isFa ? "عنوان یا نقش در بیزینس" : "Role Title"}
            </label>
            <input
              type="text"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="مثلاً: مشاور فروش و پشتیبانی"
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent/40"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              {isFa ? "حوزه فعالیت و خدمات کسب‌وکار" : "Business Type"}
            </label>
            <input
              type="text"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              placeholder="مثلاً: کلینیک زیبایی و پوست"
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent/40"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              {isFa ? "مخاطبان هدف" : "Target Audience"}
            </label>
            <input
              type="text"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="مثلاً: مراجعین متقاضی خدمات درمانی"
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent/40"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              {isFa ? "هدف اصلی مکالمه (Conversation Funnel Goal)" : "Primary Funnel Goal"}
            </label>
            <select
              value={primaryGoal}
              onChange={(e) => setPrimaryGoal(e.target.value as any)}
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent/40"
            >
              <option value="LEAD_GENERATION">{isFa ? "دریافت شماره تماس و مشخصات لید (Lead Gen)" : "Lead Generation (Phone/Email)"}</option>
              <option value="APPOINTMENT_BOOKING">{isFa ? "هدایت به رزرو نوبت و مشاوره (Booking)" : "Appointment Booking"}</option>
              <option value="PRODUCT_SALES">{isFa ? "فروش مستقیم محصول یا خدمت (Sales)" : "Direct Product Sales"}</option>
              <option value="SUPPORT_RESOLUTION">{isFa ? "پاسخگویی و حل مسئله پشتیبانی (Support)" : "Support & Resolution"}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              {isFa ? "منش و حالت شخصیتی" : "Personality Demeanor"}
            </label>
            <input
              type="text"
              value={personalityDemeanor}
              onChange={(e) => setPersonalityDemeanor(e.target.value)}
              placeholder="مثلاً: صمیمی، مطمئن، بی‌تکلف، بدون کلمات کلیشه‌ای"
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent/40"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              {isFa ? "واژگان ترجیحی برند (با کاما جدا کنید)" : "Preferred Brand Terms"}
            </label>
            <input
              type="text"
              value={preferredWordsStr}
              onChange={(e) => setPreferredWordsStr(e.target.value)}
              placeholder="مشاوره رایگان، تضمین کیفیت، نتیجه ملموس"
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent/40"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              {isFa ? "واژگان ممنوعه (علاوه بر اسلاپ‌های نظامی)" : "Forbidden Words"}
            </label>
            <input
              type="text"
              value={forbiddenWordsStr}
              onChange={(e) => setForbiddenWordsStr(e.target.value)}
              placeholder="ارزون، مفت، تضمین صددرصد، کلمات حساس"
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent/40"
            />
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              {isFa ? "سیاست برخورد با مشتری ناراضی یا شاکی" : "Unhappy Client Policy"}
            </label>
            <textarea
              rows={2}
              value={unhappyPolicy}
              onChange={(e) => setUnhappyPolicy(e.target.value)}
              placeholder="اول با کمال احترام و همدلی شنونده باش، هرگز در این حالت محصول نفروش و سریعاً به پشتیبان انسانی وصل کن."
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent/40"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              {isFa ? "سیاست پاسخ به اعتراض قیمت («گرونه»)" : "Price Objection Policy"}
            </label>
            <textarea
              rows={2}
              value={priceObjectionPolicy}
              onChange={(e) => setPriceObjectionPolicy(e.target.value)}
              placeholder="ارزش خلق‌شده و بازگشت سرمایه واقعی را توضیح بده، نه اینکه بلافاصله تخفیف بدهی."
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent/40"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              {isFa ? "کلمات کلیدی برای ارجاع فوری به انسان (با کاما)" : "Human Escalation Triggers"}
            </label>
            <input
              type="text"
              value={escalationTriggersStr}
              onChange={(e) => setEscalationTriggersStr(e.target.value)}
              placeholder="شکایت، اپراتور، مدیر، تماس فوری، واریز فیش، کارت به کارت"
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent/40"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-border flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-accent px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {saving ? (isFa ? "در حال ذخیره..." : "Saving...") : (isFa ? "ذخیره تغییرات شخصیت AI" : "Save AI Persona")}
          </button>
        </div>
      </form>
    </section>
  );
}
