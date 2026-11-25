"use client";

import React, { useEffect, useState } from "react";
import { useLanguage } from "@/context/language-context";

interface AiConfig {
  workspaceId: string;
  isEnabled: boolean;
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  brandVoice: string | null;
  defaultTone: string;
  systemPrompt: string | null;
  confidenceThreshold: number;
  manualApprovalMode: boolean;
  activeHoursEnabled: boolean;
  activeStartTime: string;
  activeEndTime: string;
  timezone: string;
  offlineMessage: string | null;
  leadNormalizerEnabled?: boolean;
  leadNormalizerMode?: "SILENT_NORMALIZE_ONLY" | "ASSISTANT_CO_PILOT";
  leadNormalizerPrompt?: string;
}

export default function AiAgentAdminPage() {
  const { language } = useLanguage();
  const isFa = language === "fa";

  const [config, setConfig] = useState<AiConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
    fetch("/api/admin/ai-config", { cache: "no-store" })
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) setConfig(res.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!config) return;

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/ai-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...config,
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage({
          type: "success",
          text: isFa ? "تنظیمات عامل هوشمند با موفقیت ذخیره شد." : "AI Agent configuration saved successfully.",
        });
        setConfig(data.data);
        setApiKey("");
      } else {
        setMessage({
          type: "error",
          text: data.error || (isFa ? "خطا در ذخیره تنظیمات." : "Failed to save configuration."),
        });
      }
    } catch {
      setMessage({
        type: "error",
        text: isFa ? "خطا در برقراری ارتباط با سرور." : "Server connection error.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    setTestingConnection(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/ai-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: config?.workspaceId || "main-workspace",
          provider: config?.provider,
          model: config?.model,
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (data.success) {
        const latency = data.latencyMs ?? data.latency ?? 0;
        setMessage({
          type: "success",
          text: isFa ? `اتصال موفق! (مدل: ${data.model}, تاخیر: ${latency}ms)` : `Success! (Model: ${data.model}, Latency: ${latency}ms)`,
        });
      } else {
        setMessage({
          type: "error",
          text: data.error || (isFa ? "ارتباط با هوش مصنوعی برقرار نشد." : "Failed to connect to AI."),
        });
      }
    } catch {
      setMessage({
        type: "error",
        text: isFa ? "خطا در برقراری ارتباط با سرور." : "Server connection error.",
      });
    } finally {
      setTestingConnection(false);
    }
  }

  if (loading) {
    return <div className="panel rounded p-8 h-64 animate-pulse bg-surface/50 max-w-4xl mx-auto" />;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {isFa ? "مدیریت عامل هوشمند (AI Agent)" : "AI Agent Management"}
        </h1>
        <p className="text-sm text-muted mt-1">
          {isFa
            ? "تنظیمات هوش مصنوعی برای پاسخ‌دهی هوشمند به کامنت‌ها و پیام‌های دایرکت اینستاگرام"
            : "Configure AI models, persona guidelines, and automated DM/comment response parameters."}
        </p>
      </div>

      {message && (
        <div
          className={`p-4 rounded border text-sm font-medium ${
            message.type === "success"
              ? "bg-success/10 border-success/30 text-success"
              : "bg-error/10 border-error/30 text-error"
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic Provider Config */}
        <section className="panel rounded p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {isFa ? "پاسخگوی خودکار دایرکت و کامنت (AI Agent Auto-Reply)" : "AI Agent Auto-Reply"}
              </h2>
              <p className="text-xs text-muted mt-0.5">
                {isFa
                  ? "فقط برای پاسخگویی هوش مصنوعی به پیام‌های آزاد دایرکت پیج. حتی اگر این گزینه خاموش باشد، «سیستم پایش و نرمال‌سازی فرم‌ها (Silent Normalizer)» به‌صورت مستقل فعال می‌ماند."
                  : "Auto-reply to general Instagram DMs. Silent Lead Normalizer stays active independently even if this is off."}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config?.isEnabled ?? true}
                onChange={(e) => setConfig((prev) => (prev ? { ...prev, isEnabled: e.target.checked } : null))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {isFa ? "سرویس دهنده (Provider)" : "Provider"}
              </label>
              <select
                value={config?.provider || "GEMINI"}
                onChange={(e) => setConfig((prev) => (prev ? { ...prev, provider: e.target.value } : null))}
                className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              >
                <option value="GEMINI">Google Gemini (اتصال مستقیم رسمی)</option>
                <option value="OPENAI">OpenAI (اتصال مستقیم رسمی)</option>
                <option value="BOXAPI">BoxAPI AI (پروکسی هوش مصنوعی اختیاری)</option>
                <option value="DEEPSEEK">DeepSeek AI</option>
                <option value="GROK">xAI Grok</option>
                <option value="ANTHROPIC">Anthropic Claude</option>
                <option value="OPENROUTER">OpenRouter</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {isFa ? "مدل هوش مصنوعی (انتخاب از لیست یا دستی)" : "AI Model Selection"}
              </label>
              <div className="space-y-1.5">
                <select
                  value={
                    [
                      "gemini-3.5-flash-lite",
                      "gemini-2.5-flash",
                      "gemini-2.5-flash-lite",
                      "gemini-2.5-pro",
                      "gemini-2.0-flash",
                      "gemini-2.0-flash-lite",
                      "gemini-1.5-flash",
                      "gemini-1.5-pro",
                      "gpt-4o",
                      "gpt-4o-mini",
                      "deepseek-chat",
                    ].includes(config?.model || "")
                      ? config?.model
                      : "custom"
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val !== "custom") {
                      setConfig((prev) => (prev ? { ...prev, model: val } : null));
                    }
                  }}
                  className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                >
                  <optgroup label="مدل‌های رسمی Google Gemini">
                    <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash Lite (فوق سریع و سبک)</option>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash (پیشنهادی - سریع و دقیق)</option>
                    <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
                    <option value="gemini-2.5-pro">Gemini 2.5 Pro (استدلال پیشرفته)</option>
                    <option value="gemini-2.0-flash">Gemini 2.0 Flash (نسل جدید چندوجهی)</option>
                    <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash Lite (بسیار سبک و سریع)</option>
                    <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                  </optgroup>
                  <optgroup label="سایر مدل‌ها">
                    <option value="gpt-4o">OpenAI GPT-4o</option>
                    <option value="gpt-4o-mini">OpenAI GPT-4o-mini</option>
                    <option value="deepseek-chat">DeepSeek Chat</option>
                  </optgroup>
                  <option value="custom">سفارشی / نام دستی دیگر...</option>
                </select>

                <input
                  type="text"
                  value={config?.model || "gemini-2.5-flash"}
                  onChange={(e) => setConfig((prev) => (prev ? { ...prev, model: e.target.value } : null))}
                  placeholder="یا نام مدل دلخواه را دستی بنویسید (مثال: gemini-2.5-flash)"
                  className="w-full rounded border border-border bg-surface px-3 py-1.5 text-xs text-foreground outline-none focus:border-accent"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-foreground">
                  {isFa ? "کلیدهای API (پشتیبانی از چند کلید چرخشی - Multi-Key Failover Pool)" : "API Keys (Failover Pool)"}
                </label>
                <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-medium">
                  سوئیچ خودکار در صورت خطا
                </span>
              </div>
              <textarea
                rows={2}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  isFa
                    ? "یک یا چند API Key وارد کنید (هر کلید در یک خط یا با کاما جدا شود). در صورت خطای Rate Limit یا سهمیه، سیستم خودکار روی بعدی سوییچ می‌کند."
                    : "Enter one or multiple API keys (one per line or comma-separated) for automated failover."
                }
                className="w-full rounded border border-border bg-surface px-3 py-2 text-xs font-mono text-foreground outline-none focus:border-accent"
              />
              <p className="text-[11px] text-muted mt-1">
                🛡️ ایمنی ۱۰۰٪ کاربر: در صورت بروز هرگونه خطای API یا اتمام اعتبار، به هیچ وجه ارور یا پیام نامربوطی به کاربر دایرکت ارسال نخواهد شد.
              </p>
            </div>
          </div>
        </section>

        {/* Lead Normalizer & Data Extraction Settings */}
        <section className="panel rounded p-6 space-y-4 border border-accent/20 bg-accent/5">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">
                  {isFa ? "سیستم پایش و نرمال‌سازی نام و شماره لیدها (Silent Normalizer)" : "Silent Lead Normalizer & Data Extraction"}
                </h2>
                <span className="text-[11px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-medium">
                  {isFa ? "مستقل از AI Agent" : "Independent of AI Agent"}
                </span>
              </div>
              <p className="text-xs text-muted mt-1">
                {isFa
                  ? "فقط در فرم‌های دریافت مشخصات (نام و شماره) کار می‌کند و به دایرکت‌های آزاد پیج پاسخی نمی‌دهد — حتی وقتی AI Agent خاموش است."
                  : "Runs strictly inside lead capture forms without enabling page-wide AI DM replies."}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config?.leadNormalizerEnabled ?? true}
                onChange={(e) =>
                  setConfig((prev) => (prev ? { ...prev, leadNormalizerEnabled: e.target.checked } : null))
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {isFa ? "حالت عملکرد نرمال‌ساز (Normalizer Mode)" : "Normalizer Mode"}
              </label>
              <select
                value={config?.leadNormalizerMode || "SILENT_NORMALIZE_ONLY"}
                onChange={(e) =>
                  setConfig((prev) =>
                    prev
                      ? {
                          ...prev,
                          leadNormalizerMode: e.target.value as "SILENT_NORMALIZE_ONLY" | "ASSISTANT_CO_PILOT",
                        }
                      : null
                  )
                }
                className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              >
                <option value="SILENT_NORMALIZE_ONLY">
                  {isFa
                    ? "حالت ۱۰۰٪ نامحسوس (Silent Mode - بدون ارسال هیچ پیام AI به کاربر)"
                    : "100% Silent Mode (No AI messages sent to customer)"}
                </option>
                <option value="ASSISTANT_CO_PILOT">
                  {isFa
                    ? "حالت دستیار تعاملی (Co-Pilot - پاسخ کوتاه به سوال احتمالی + استخراج)"
                    : "Co-Pilot Mode (Short answer to question + extraction)"}
                </option>
              </select>
              <p className="text-[11px] text-muted mt-1">
                {isFa
                  ? "در حالت نامحسوس، کاربر اصلاً متوجه حضور هوش مصنوعی نمی‌شود؛ نام و شماره پاکسازی شده و فرم روند عادیش را طی می‌کند."
                  : "In silent mode, customers never see any AI messages; data is cleaned and registered silently in CRM."}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-surface/50 p-3 space-y-1">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                ⚡ فیلتر سریع صفر-توکن (Fast Path 0ms):
              </span>
              <p className="text-[11px] text-muted leading-relaxed">
                اگر کاربر ورودی تمیز ۲ کلمه‌ای (مانند «آرمین طهماسبی») یا شماره ۱۱ رقمی بفرستد، سیستم بدون مصرف حتی ۱ توکن هوش مصنوعی و با سرعت صفر میلی‌ثانیه مستقیماً در CRM ذخیره می‌کند.
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-foreground mb-1">
                {isFa ? "دستورالعمل و پرامپت اختصاصی استخراج لید (اختیاری)" : "Custom Lead Normalizer Prompt (Optional)"}
              </label>
              <textarea
                rows={3}
                value={config?.leadNormalizerPrompt || ""}
                onChange={(e) =>
                  setConfig((prev) => (prev ? { ...prev, leadNormalizerPrompt: e.target.value } : null))
                }
                placeholder={
                  isFa
                    ? "در صورت خالی بودن، از پرامپت پیش‌فرض بهینه‌شده فارسی برای تفکیک نام و نام خانوادگی، شماره و یادداشت‌ها استفاده می‌شود..."
                    : "Leave blank to use default optimized Persian extraction prompt..."
                }
                className="w-full rounded border border-border bg-surface px-3 py-2 text-xs font-mono text-foreground outline-none focus:border-accent"
              />
            </div>
          </div>
        </section>

        {/* Persona & System Prompt */}
        <section className="panel rounded p-6 space-y-4">
          <h2 className="text-base font-semibold text-foreground border-b border-border pb-3">
            {isFa ? "پرسونا و دستورالعمل سیستم (System Prompt)" : "Persona & System Prompt"}
          </h2>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              {isFa ? "لحن برند (Brand Voice)" : "Brand Voice / Tone"}
            </label>
            <input
              type="text"
              value={config?.brandVoice || ""}
              onChange={(e) => setConfig((prev) => (prev ? { ...prev, brandVoice: e.target.value } : null))}
              placeholder={isFa ? "مثال: صمیمی، حرفه‌ای و پاسخ‌دهی بدون حاشیه" : "e.g. Friendly, professional, concise, direct sales partner"}
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              {isFa ? "دستور اصلی عامل هوشمند (System Prompt)" : "System Instructions Prompt"}
            </label>
            <textarea
              rows={4}
              value={config?.systemPrompt || ""}
              onChange={(e) => setConfig((prev) => (prev ? { ...prev, systemPrompt: e.target.value } : null))}
              placeholder={
                isFa
                  ? "شما دستیار هوشمند پاسخ‌دهی به لیدهای اینستاگرام هستید..."
                  : "You are an intelligent Instagram AI assistant driving sales & appointment bookings..."
              }
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>
        </section>

        {/* Hyperparameters & Safety */}
        <section className="panel rounded p-6 space-y-4">
          <h2 className="text-base font-semibold text-foreground border-b border-border pb-3">
            {isFa ? "پارامترهای عملکردی و ایمنی" : "Hyperparameters & Safety"}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {isFa ? "میزان خلاقیت (Temperature):" : "Temperature:"} {config?.temperature ?? 0.7}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={config?.temperature ?? 0.7}
                onChange={(e) => setConfig((prev) => (prev ? { ...prev, temperature: parseFloat(e.target.value) } : null))}
                className="w-full accent-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {isFa ? "حد نصاب اطمینان (Confidence Threshold):" : "Confidence Threshold:"} {config?.confidenceThreshold ?? 0.75}
              </label>
              <input
                type="range"
                min="0.5"
                max="0.99"
                step="0.01"
                value={config?.confidenceThreshold ?? 0.75}
                onChange={(e) => setConfig((prev) => (prev ? { ...prev, confidenceThreshold: parseFloat(e.target.value) } : null))}
                className="w-full accent-accent"
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config?.manualApprovalMode ?? false}
                onChange={(e) => setConfig((prev) => (prev ? { ...prev, manualApprovalMode: e.target.checked } : null))}
                className="rounded border-border text-accent focus:ring-accent h-4 w-4"
              />
              <span className="text-sm font-medium text-foreground">
                {isFa ? "تایید دستی پیش از ارسال پاسخ (Human In The Loop)" : "Manual approval required before sending AI replies"}
              </span>
            </label>
          </div>
        </section>

        {/* Scheduling / Active Hours */}
        <section className="panel rounded p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-base font-semibold text-foreground">
              {isFa ? "زمان‌بندی و شیفت کاری (Active Hours)" : "Scheduling & Active Hours"}
            </h2>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config?.activeHoursEnabled ?? false}
                onChange={(e) => setConfig((prev) => (prev ? { ...prev, activeHoursEnabled: e.target.checked } : null))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
            </label>
          </div>
          
          {config?.activeHoursEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  {isFa ? "زمان شروع (Start Time)" : "Start Time"}
                </label>
                <input
                  type="time"
                  value={config?.activeStartTime || "17:00"}
                  onChange={(e) => setConfig((prev) => (prev ? { ...prev, activeStartTime: e.target.value } : null))}
                  className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  {isFa ? "زمان پایان (End Time)" : "End Time"}
                </label>
                <input
                  type="time"
                  value={config?.activeEndTime || "08:00"}
                  onChange={(e) => setConfig((prev) => (prev ? { ...prev, activeEndTime: e.target.value } : null))}
                  className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  {isFa ? "منطقه زمانی (Timezone)" : "Timezone"}
                </label>
                <select
                  value={config?.timezone || "Asia/Tehran"}
                  onChange={(e) => setConfig((prev) => (prev ? { ...prev, timezone: e.target.value } : null))}
                  className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                >
                  <option value="Asia/Tehran">Asia/Tehran</option>
                  <option value="Asia/Dubai">Asia/Dubai</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-foreground mb-1">
                  {isFa ? "پیام زمان آفلاینی (Offline Message)" : "Offline Message"}
                </label>
                <input
                  type="text"
                  value={config?.offlineMessage || ""}
                  onChange={(e) => setConfig((prev) => (prev ? { ...prev, offlineMessage: e.target.value } : null))}
                  placeholder={isFa ? "خالی بگذارید تا هوش مصنوعی ساکت بماند." : "Leave blank to stay silent."}
                  className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                />
              </div>
            </div>
          )}
        </section>

        <div className="flex justify-between items-center mt-6">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testingConnection}
            className="px-6 py-2.5 rounded border border-accent text-accent hover:bg-accent hover:text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {testingConnection ? (isFa ? "در حال تست..." : "Testing...") : (isFa ? "تست اتصال به سرور AI" : "Test API Connection")}
          </button>
          
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? (isFa ? "در حال ذخیره..." : "Saving...") : (isFa ? "ذخیره تنظیمات AI Agent" : "Save AI Agent Settings")}
          </button>
        </div>
      </form>
    </div>
  );
}
