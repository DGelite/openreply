"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/context/language-context";

interface AiConfigData {
  isEnabled: boolean;
  provider: "GEMINI" | "OPENAI" | "BOXAPI" | string;
  model: string;
  geminiModel: string;
  hasGeminiApiKey: boolean;
  geminiApiKeyMasked: string;
  openAiModel: string;
  hasOpenAiApiKey: boolean;
  openAiApiKeyMasked: string;
  boxApiAiEnabled: boolean;
  boxApiAiModel: string;
  hasBoxApiAiKey: boolean;
  boxApiAiKeyMasked: string;
  boxApiAiBaseUrl: string;
  embeddingProvider: string;
  embeddingModel: string;
  allowAiFallback: boolean;
  lastTestStatus: Record<string, {
    success: boolean;
    latencyMs?: number;
    model?: string;
    timestamp?: string;
    verifiedDirect?: boolean;
  }>;
}

export function AiProviderCard() {
  const { language } = useLanguage();
  const isFa = language === "fa";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [reindexing, setReindexing] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form State
  const [activeProvider, setActiveProvider] = useState<"GEMINI" | "OPENAI" | "BOXAPI">("GEMINI");
  const [geminiKey, setGeminiKey] = useState("");
  const [geminiModel, setGeminiModel] = useState("gemini-2.5-flash");
  const [hasGeminiKey, setHasGeminiKey] = useState(false);

  const [openAiKey, setOpenAiKey] = useState("");
  const [openAiModel, setOpenAiModel] = useState("gpt-4o-mini");
  const [hasOpenAiKey, setHasOpenAiKey] = useState(false);

  const [boxApiAiEnabled, setBoxApiAiEnabled] = useState(false);
  const [boxApiAiKey, setBoxApiAiKey] = useState("");
  const [boxApiAiModel, setBoxApiAiModel] = useState("gpt-4o-mini");
  const [hasBoxApiKey, setHasBoxApiKey] = useState(false);

  const [embeddingProvider, setEmbeddingProvider] = useState("GEMINI");
  const [embeddingModel, setEmbeddingModel] = useState("text-embedding-004");
  const [allowAiFallback, setAllowAiFallback] = useState(false);

  const [testStatuses, setTestStatuses] = useState<Record<string, any>>({});

  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/admin/ai-config", { cache: "no-store" });
      const payload = await res.json();
      if (payload.success && payload.data) {
        const d: AiConfigData = payload.data;
        setActiveProvider((d.provider as any) || "GEMINI");
        setGeminiModel(d.geminiModel || "gemini-2.5-flash");
        setHasGeminiKey(d.hasGeminiApiKey);

        setOpenAiModel(d.openAiModel || "gpt-4o-mini");
        setHasOpenAiKey(d.hasOpenAiApiKey);

        setBoxApiAiEnabled(Boolean(d.boxApiAiEnabled));
        setBoxApiAiModel(d.boxApiAiModel || "gpt-4o-mini");
        setHasBoxApiKey(d.hasBoxApiAiKey);

        setEmbeddingProvider(d.embeddingProvider || "GEMINI");
        setEmbeddingModel(d.embeddingModel || "text-embedding-004");
        setAllowAiFallback(Boolean(d.allowAiFallback));
        setTestStatuses(d.lastTestStatus || {});
      }
    } catch (err) {
      console.error("Failed to load AI config:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleTestConnection = async (providerName: "GEMINI" | "OPENAI" | "BOXAPI") => {
    setTesting(providerName);
    setMessage(null);

    const testPayload: Record<string, any> = { provider: providerName };
    if (providerName === "GEMINI") {
      if (geminiKey.trim()) testPayload.apiKey = geminiKey.trim();
      testPayload.model = geminiModel;
    } else if (providerName === "OPENAI") {
      if (openAiKey.trim()) testPayload.apiKey = openAiKey.trim();
      testPayload.model = openAiModel;
    } else if (providerName === "BOXAPI") {
      if (boxApiAiKey.trim()) testPayload.apiKey = boxApiAiKey.trim();
      testPayload.model = boxApiAiModel;
    }

    try {
      const res = await fetch("/api/admin/ai-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testPayload),
      });

      const payload = await res.json();
      if (payload.success) {
        setMessage({ type: "success", text: payload.message });
        setTestStatuses((prev) => ({
          ...prev,
          [providerName]: {
            success: true,
            model: payload.model,
            latencyMs: payload.latencyMs,
            timestamp: new Date().toISOString(),
          },
        }));
      } else {
        setMessage({ type: "error", text: payload.error || "تست اتصال با خطا مواجه شد." });
        setTestStatuses((prev) => ({
          ...prev,
          [providerName]: {
            success: false,
            timestamp: new Date().toISOString(),
          },
        }));
      }
    } catch {
      setMessage({ type: "error", text: "خطای شبکه هنگام ارسال تست اتصال." });
    } finally {
      setTesting(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    if (activeProvider === "BOXAPI" && !boxApiAiEnabled) {
      setMessage({
        type: "error",
        text: isFa
          ? "برای انتخاب BoxAPI به عنوان پرووایدر اصلی، باید تیک فعال‌سازی BoxAPI AI را روشن کنید."
          : "You must enable BoxAPI AI to set it as the active provider.",
      });
      setSaving(false);
      return;
    }

    const payload: Record<string, any> = {
      provider: activeProvider,
      model:
        activeProvider === "OPENAI"
          ? openAiModel
          : activeProvider === "BOXAPI"
          ? boxApiAiModel
          : geminiModel,
      geminiModel,
      openAiModel,
      boxApiAiEnabled,
      boxApiAiModel,
      embeddingProvider,
      embeddingModel,
      allowAiFallback,
    };

    if (geminiKey.trim()) payload.geminiApiKey = geminiKey.trim();
    if (openAiKey.trim()) payload.openAiApiKey = openAiKey.trim();
    if (boxApiAiKey.trim()) payload.boxApiAiKey = boxApiAiKey.trim();

    try {
      const res = await fetch("/api/admin/ai-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (result.success) {
        setMessage({
          type: "success",
          text: isFa ? "✅ تنظیمات سرویس‌های هوش مصنوعی با موفقیت ذخیره شد." : "AI Providers saved successfully.",
        });
        setGeminiKey("");
        setOpenAiKey("");
        setBoxApiAiKey("");
        await fetchConfig();
      } else {
        setMessage({ type: "error", text: result.error || "خطا در ذخیره تنظیمات." });
      }
    } catch {
      setMessage({ type: "error", text: "خطای ارتباط با سرور." });
    } finally {
      setSaving(false);
    }
  };

  const handleReindexKnowledge = async () => {
    const confirmMsg = isFa
      ? "آیا از بازسازی و برداری‌سازی مجدد تمام اسناد پایگاه دانش اطمینان دارید؟"
      : "Reindex all knowledge base documents with current embedding model?";
    if (!confirm(confirmMsg)) return;

    setReindexing(true);
    setMessage(null);

    try {
      const res = await fetch("/api/settings/knowledge/reindex", {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: `✅ ${data.message}` });
      } else {
        setMessage({ type: "error", text: data.error || "خطا در بازسازی ایندکس پایگاه دانش." });
      }
    } catch {
      setMessage({ type: "error", text: "خطای شبکه هنگام بازسازی ایندکس." });
    } finally {
      setReindexing(false);
    }
  };

  if (loading) {
    return <div className="panel rounded p-6 animate-pulse h-48 bg-surface/50" />;
  }

  return (
    <section className="panel rounded p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {isFa ? "مدیریت ارائه‌دهندگان هوش مصنوعی (AI Providers Management)" : "AI Providers Management"}
          </h2>
          <p className="text-xs text-muted mt-0.5">
            {isFa
              ? "انتخاب و پیکربندی مستقیم پرووایدرهای رسمی Google Gemini و OpenAI، یا سرویس اختیاری BoxAPI AI"
              : "Direct official integration for OpenAI and Google Gemini, with optional BoxAPI AI proxy."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">{isFa ? "پرووایدر فعال:" : "Active:"}</span>
          <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-accent text-white shadow-sm">
            {activeProvider === "GEMINI"
              ? "Google Gemini (رسمی)"
              : activeProvider === "OPENAI"
              ? "OpenAI (رسمی)"
              : "BoxAPI AI (پروکسی)"}
          </span>
        </div>
      </div>

      {message && (
        <div
          className={`p-3 rounded text-xs font-medium ${
            message.type === "success"
              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
              : "bg-red-500/10 text-red-600 border border-red-500/20"
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Provider Selection Cards */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-3">
            {isFa ? "انتخاب ارائه‌دهنده فعال برای تولید پاسخ و چت:" : "Select Active Chat Completion Provider:"}
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Google Gemini Card */}
            <div
              onClick={() => setActiveProvider("GEMINI")}
              className={`p-4 rounded border cursor-pointer transition-all ${
                activeProvider === "GEMINI"
                  ? "border-accent bg-accent/5 ring-1 ring-accent"
                  : "border-border bg-surface/50 hover:bg-surface"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm text-foreground">Google Gemini</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-medium">
                  {isFa ? "API مستقیم رسمی" : "Direct Official API"}
                </span>
              </div>
              <p className="text-xs text-muted mb-2">
                {isFa
                  ? "اتصال مستقیم به generativelanguage.googleapis.com با سرعت بالا و هزینه کم"
                  : "Direct official Google connection without intermediaries."}
              </p>
              <div className="flex items-center justify-between text-[11px] pt-2 border-t border-border/50">
                <span className="text-muted">{geminiModel}</span>
                <span className={testStatuses["GEMINI"]?.success ? "text-emerald-500 font-medium" : "text-muted"}>
                  {testStatuses["GEMINI"]?.success
                    ? `${isFa ? "متصل" : "Connected"} (${testStatuses["GEMINI"]?.latencyMs}ms)`
                    : (isFa ? "تست نشده" : "Untested")}
                </span>
              </div>
            </div>

            {/* OpenAI Card */}
            <div
              onClick={() => setActiveProvider("OPENAI")}
              className={`p-4 rounded border cursor-pointer transition-all ${
                activeProvider === "OPENAI"
                  ? "border-accent bg-accent/5 ring-1 ring-accent"
                  : "border-border bg-surface/50 hover:bg-surface"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm text-foreground">OpenAI</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-medium">
                  {isFa ? "API مستقیم رسمی" : "Direct Official API"}
                </span>
              </div>
              <p className="text-xs text-muted mb-2">
                {isFa
                  ? "اتصال مستقیم به api.openai.com رسمی (مدل‌های GPT-4o و GPT-4o-mini)"
                  : "Direct official OpenAI connection without intermediaries."}
              </p>
              <div className="flex items-center justify-between text-[11px] pt-2 border-t border-border/50">
                <span className="text-muted">{openAiModel}</span>
                <span className={testStatuses["OPENAI"]?.success ? "text-emerald-500 font-medium" : "text-muted"}>
                  {testStatuses["OPENAI"]?.success
                    ? `${isFa ? "متصل" : "Connected"} (${testStatuses["OPENAI"]?.latencyMs}ms)`
                    : (isFa ? "تست نشده" : "Untested")}
                </span>
              </div>
            </div>

            {/* BoxAPI AI Card */}
            <div
              onClick={() => {
                if (boxApiAiEnabled) {
                  setActiveProvider("BOXAPI");
                }
              }}
              className={`p-4 rounded border transition-all ${
                !boxApiAiEnabled
                  ? "opacity-60 border-border bg-surface/20 cursor-not-allowed"
                  : activeProvider === "BOXAPI"
                  ? "border-accent bg-accent/5 ring-1 ring-accent cursor-pointer"
                  : "border-border bg-surface/50 hover:bg-surface cursor-pointer"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm text-foreground">BoxAPI AI</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  boxApiAiEnabled ? "bg-amber-500/10 text-amber-600" : "bg-muted/10 text-muted"
                }`}>
                  {boxApiAiEnabled ? (isFa ? "پروکسی اختیاری" : "Optional Proxy") : (isFa ? "غیرفعال" : "Disabled")}
                </span>
              </div>
              <p className="text-xs text-muted mb-2">
                {isFa
                  ? "سرویس پروکسی هوش مصنوعی boxapi.ir (به‌صورت پیش‌فرض غیرفعال است)"
                  : "Proprietary BoxAPI proxy endpoint. Disabled by default."}
              </p>
              <div className="flex items-center justify-between text-[11px] pt-2 border-t border-border/50">
                <span className="text-muted">{boxApiAiModel}</span>
                <span className={testStatuses["BOXAPI"]?.success ? "text-emerald-500 font-medium" : "text-muted"}>
                  {testStatuses["BOXAPI"]?.success
                    ? `${isFa ? "متصل" : "Connected"} (${testStatuses["BOXAPI"]?.latencyMs}ms)`
                    : (isFa ? "تست نشده" : "Untested")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Provider Settings Section */}
        <div className="space-y-4 pt-2">
          {/* 1. Google Gemini Config */}
          <div className="p-4 rounded border border-border bg-surface/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                {isFa ? "تنظیمات اختصاصی Google Gemini (API رسمی)" : "Google Gemini Official Settings"}
              </span>
              <button
                type="button"
                onClick={() => handleTestConnection("GEMINI")}
                disabled={testing === "GEMINI"}
                className="text-xs px-3 py-1 rounded border border-border hover:bg-surface transition-colors text-foreground disabled:opacity-50"
              >
                {testing === "GEMINI" ? (isFa ? "در حال تست..." : "Testing...") : (isFa ? "تست اتصال زنده Gemini" : "Test Gemini")}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  {isFa ? "انتخاب مدل Gemini" : "Gemini Model"}
                </label>
                <select
                  value={geminiModel}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  className="w-full rounded border border-border bg-surface px-3 py-1.5 text-xs text-foreground outline-none focus:border-accent"
                >
                  <option value="gemini-2.5-flash">gemini-2.5-flash (پیشنهادی - سریع و دقیق)</option>
                  <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite (فوق سریع)</option>
                  <option value="gemini-2.5-pro">gemini-2.5-pro (استدلال عمیق)</option>
                  <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                  <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  {isFa ? "کلید Google Gemini API Key" : "Gemini API Key"}
                </label>
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder={hasGeminiKey ? "•••••••••••••••• (ذخیره شده - خالی بگذارید تا تغییر نکند)" : "AIzaSy..."}
                  className="w-full rounded border border-border bg-surface px-3 py-1.5 text-xs text-foreground outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>

          {/* 2. OpenAI Config */}
          <div className="p-4 rounded border border-border bg-surface/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                {isFa ? "تنظیمات اختصاصی OpenAI (API رسمی)" : "OpenAI Official Settings"}
              </span>
              <button
                type="button"
                onClick={() => handleTestConnection("OPENAI")}
                disabled={testing === "OPENAI"}
                className="text-xs px-3 py-1 rounded border border-border hover:bg-surface transition-colors text-foreground disabled:opacity-50"
              >
                {testing === "OPENAI" ? (isFa ? "در حال تست..." : "Testing...") : (isFa ? "تست اتصال زنده OpenAI" : "Test OpenAI")}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  {isFa ? "انتخاب مدل OpenAI" : "OpenAI Model"}
                </label>
                <select
                  value={openAiModel}
                  onChange={(e) => setOpenAiModel(e.target.value)}
                  className="w-full rounded border border-border bg-surface px-3 py-1.5 text-xs text-foreground outline-none focus:border-accent"
                >
                  <option value="gpt-4o-mini">gpt-4o-mini (پیشنهادی - مقرون‌به‌صرفه و هوشمند)</option>
                  <option value="gpt-4o">gpt-4o (قدرتمندترین مدل عمومی)</option>
                  <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                  <option value="gpt-4-turbo">gpt-4-turbo</option>
                  <option value="o3-mini">o3-mini (استدلالی)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  {isFa ? "کلید OpenAI API Key" : "OpenAI API Key"}
                </label>
                <input
                  type="password"
                  value={openAiKey}
                  onChange={(e) => setOpenAiKey(e.target.value)}
                  placeholder={hasOpenAiKey ? "•••••••••••••••• (ذخیره شده - خالی بگذارید تا تغییر نکند)" : "sk-proj-..."}
                  className="w-full rounded border border-border bg-surface px-3 py-1.5 text-xs text-foreground outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>

          {/* 3. BoxAPI AI Config (Optional & Guarded) */}
          <div className="p-4 rounded border border-border bg-surface/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enable-boxapi-ai"
                  checked={boxApiAiEnabled}
                  onChange={(e) => {
                    setBoxApiAiEnabled(e.target.checked);
                    if (!e.target.checked && activeProvider === "BOXAPI") {
                      setActiveProvider("GEMINI");
                    }
                  }}
                  className="rounded border-border text-accent focus:ring-accent"
                />
                <label htmlFor="enable-boxapi-ai" className="text-xs font-semibold text-foreground cursor-pointer">
                  {isFa ? "فعال‌سازی سرویس اختیاری BoxAPI AI (پیش‌فرض خاموش)" : "Enable Optional BoxAPI AI"}
                </label>
              </div>

              {boxApiAiEnabled && (
                <button
                  type="button"
                  onClick={() => handleTestConnection("BOXAPI")}
                  disabled={testing === "BOXAPI"}
                  className="text-xs px-3 py-1 rounded border border-border hover:bg-surface transition-colors text-foreground disabled:opacity-50"
                >
                  {testing === "BOXAPI" ? (isFa ? "در حال تست..." : "Testing...") : (isFa ? "تست اتصال BoxAPI AI" : "Test BoxAPI AI")}
                </button>
              )}
            </div>

            <p className="text-xs text-muted">
              {isFa
                ? "تذکر امنیتی: در صورت غیرفعال بودن این گزینه، هیچ درخواستی به BoxAPI AI ارسال نمی‌شود و با خطای OpenAI یا Gemini هرگز به آن سوئیچ نخواهد شد."
                : "When disabled, zero requests are dispatched to BoxAPI AI. No silent fallback will ever occur."}
            </p>

            {boxApiAiEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    {isFa ? "مدل BoxAPI AI" : "BoxAPI AI Model"}
                  </label>
                  <select
                    value={boxApiAiModel}
                    onChange={(e) => setBoxApiAiModel(e.target.value)}
                    className="w-full rounded border border-border bg-surface px-3 py-1.5 text-xs text-foreground outline-none focus:border-accent"
                  >
                    <option value="gpt-4o-mini">gpt-4o-mini (از طریق سرور BoxAPI)</option>
                    <option value="gpt-4o">gpt-4o</option>
                    <option value="claude-3-5-sonnet">claude-3-5-sonnet</option>
                    <option value="deepseek-chat">deepseek-chat</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    {isFa ? "توکن BoxAPI AI Token (یا کلید عمومی)" : "BoxAPI AI Token"}
                  </label>
                  <input
                    type="password"
                    value={boxApiAiKey}
                    onChange={(e) => setBoxApiAiKey(e.target.value)}
                    placeholder={hasBoxApiKey ? "•••••••••••••••• (ذخیره شده)" : "توکن دیتا یا کلید BoxAPI"}
                    className="w-full rounded border border-border bg-surface px-3 py-1.5 text-xs text-foreground outline-none focus:border-accent"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 4. Independent Embedding Configuration & Dimension Guard */}
        <div className="p-4 rounded border border-border bg-surface/30 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold text-foreground">
                {isFa ? "تنظیمات مستقل برداری‌سازی و پایگاه دانش (Embedding Settings)" : "Independent Embedding Settings"}
              </h3>
              <p className="text-[11px] text-muted mt-0.5">
                {isFa
                  ? "تولید بردارها برای RAG به صورت کاملاً مستقل از مدل چت انجام می‌شود."
                  : "Vector embeddings for Knowledge Base RAG operate independently of the chat model."}
              </p>
            </div>
            <button
              type="button"
              onClick={handleReindexKnowledge}
              disabled={reindexing}
              className="text-xs px-3 py-1.5 rounded bg-accent/10 text-accent hover:bg-accent/20 transition-colors font-medium disabled:opacity-50"
            >
              {reindexing
                ? (isFa ? "در حال بازسازی بردارها..." : "Reindexing...")
                : (isFa ? "⚡ بازسازی بردارهای اسناد (Reindex)" : "Reindex Vectors")}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {isFa ? "سرویس‌دهنده Embedding" : "Embedding Provider"}
              </label>
              <select
                value={embeddingProvider}
                onChange={(e) => {
                  const val = e.target.value;
                  setEmbeddingProvider(val);
                  setEmbeddingModel(val === "OPENAI" ? "text-embedding-3-small" : "text-embedding-004");
                }}
                className="w-full rounded border border-border bg-surface px-3 py-1.5 text-xs text-foreground outline-none focus:border-accent"
              >
                <option value="GEMINI">Google Gemini (text-embedding-004 - ۷۶۸ بُعدی)</option>
                <option value="OPENAI">OpenAI (text-embedding-3-small - ۱۵۳۶ بُعدی)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {isFa ? "مدل Embedding" : "Embedding Model"}
              </label>
              <input
                type="text"
                value={embeddingModel}
                onChange={(e) => setEmbeddingModel(e.target.value)}
                className="w-full rounded border border-border bg-surface px-3 py-1.5 text-xs text-foreground outline-none focus:border-accent"
              />
            </div>
          </div>
        </div>

        {/* 5. Fallback Policy Guard */}
        <div className="flex items-center gap-2 p-3 rounded border border-border bg-surface/20">
          <input
            type="checkbox"
            id="allow-ai-fallback"
            checked={allowAiFallback}
            onChange={(e) => setAllowAiFallback(e.target.checked)}
            className="rounded border-border text-accent focus:ring-accent"
          />
          <label htmlFor="allow-ai-fallback" className="text-xs text-muted cursor-pointer">
            {isFa
              ? "اجازه به سیستم جهت سوئیچ اضطراری خودکار به BoxAPI در صورت خطای کامل پرووایدر اصلی (به‌صورت پیش‌فرض خاموش)"
              : "Allow emergency fallback to BoxAPI only if primary provider fails (disabled by default)."}
          </label>
        </div>

        {/* Submit Button */}
        <div className="pt-3 border-t border-border flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-accent px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {saving ? (isFa ? "در حال ذخیره..." : "Saving...") : (isFa ? "ذخیره تنظیمات ارائه‌دهندگان هوش مصنوعی" : "Save AI Providers")}
          </button>
        </div>
      </form>
    </section>
  );
}
