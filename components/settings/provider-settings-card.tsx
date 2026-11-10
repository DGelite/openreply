"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/context/language-context";

interface ProviderConfig {
  accountId: string;
  username: string;
  instagramId: string;
  orchestrationMode: "BOXAPI_PRIMARY" | "META_PRIMARY" | "SMART_HYBRID";
  primaryProvider: "META" | "BOXAPI";
  backupProvider: "META" | "BOXAPI" | null;
  boxAccountId: string | null;
  hasBoxApiKey: boolean;
  hasBoxApiToken: boolean;
  hasBoxWebhookSecret: boolean;
  boxConnectedAt: string | null;
  hasMetaToken: boolean;
  lastFailoverAt: string | null;
  failoverCount: number;
  recentFailovers: Array<{
    id: string;
    fromProvider: string;
    toProvider: string;
    reason: string;
    createdAt: string;
  }>;
}

export function ProviderSettingsCard({ accountId }: { accountId?: string }) {
  const { language } = useLanguage();
  const isFa = language === "fa";

  const [config, setConfig] = useState<ProviderConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form states
  const [orchestrationMode, setOrchestrationMode] = useState<"BOXAPI_PRIMARY" | "META_PRIMARY" | "SMART_HYBRID">("META_PRIMARY");
  const [primaryProvider, setPrimaryProvider] = useState<"META" | "BOXAPI">("META");
  const [backupProvider, setBackupProvider] = useState<"META" | "BOXAPI" | "NONE">("BOXAPI");
  const [boxAccountId, setBoxAccountId] = useState("");
  const [boxApiKey, setBoxApiKey] = useState("");
  const [boxApiToken, setBoxApiToken] = useState("");
  const [boxWebhookSecret, setBoxWebhookSecret] = useState("");

  const fetchConfig = async () => {
    try {
      const url = accountId ? `/api/settings/provider?accountId=${accountId}` : "/api/settings/provider";
      const res = await fetch(url);
      const payload = await res.json();
      if (payload.success && payload.data) {
        const d = payload.data;
        setConfig(d);
        setOrchestrationMode(d.orchestrationMode);
        setPrimaryProvider(d.primaryProvider);
        setBackupProvider(d.backupProvider || "NONE");
        setBoxAccountId(d.boxAccountId || "");
      }
    } catch (err) {
      console.error("Error fetching provider config:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [accountId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/settings/provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_config",
          accountId: config?.accountId,
          orchestrationMode,
          primaryProvider,
          backupProvider: backupProvider === "NONE" ? null : backupProvider,
          boxAccountId,
          boxApiKey: boxApiKey.trim() || undefined,
          boxApiToken: boxApiToken.trim() || undefined,
          boxWebhookSecret: boxWebhookSecret.trim() || undefined,
        }),
      });

      const payload = await res.json();
      if (payload.success) {
        setMessage({ type: "success", text: isFa ? "تنظیمات ارائه‌دهنده با موفقیت ذخیره شد." : "Provider settings saved successfully." });
        setBoxApiKey("");
        setBoxApiToken("");
        setBoxWebhookSecret("");
        await fetchConfig();
      } else {
        setMessage({ type: "error", text: payload.error || (isFa ? "خطا در ذخیره تنظیمات" : "Failed to save settings") });
      }
    } catch {
      setMessage({ type: "error", text: isFa ? "خطای ارتباط با سرور" : "Network error" });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_connection",
          accountId: config?.accountId,
        }),
      });
      const payload = await res.json();
      if (payload.success) {
        setMessage({ type: "success", text: payload.message || "اتصال با موفقیت تأیید شد." });
      } else {
        setMessage({ type: "error", text: payload.error || payload.message || "خطا در برقراری اتصال" });
      }
    } catch {
      setMessage({ type: "error", text: isFa ? "خطای شبکه هنگام تست" : "Network error testing connection" });
    } finally {
      setTesting(false);
    }
  };

  const handleReconcile = async () => {
    setReconciling(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "trigger_reconciliation",
          accountId: config?.accountId,
        }),
      });
      const payload = await res.json();
      if (payload.success) {
        const rep = payload.data;
        const msg = isFa
          ? `حسابرسی انجام شد: ${rep.totalCommentsScanned || 0} کامنت بررسی شد و ${rep.totalLeadsRecovered || 0} لید بازیابی شد.`
          : `Reconciliation complete: ${rep.totalCommentsScanned || 0} scanned, ${rep.totalLeadsRecovered || 0} leads recovered.`;
        setMessage({ type: "success", text: msg });
      } else {
        setMessage({ type: "error", text: payload.error || "خطا در فرآیند بازیابی" });
      }
    } catch {
      setMessage({ type: "error", text: isFa ? "خطا در ارسال درخواست حسابرسی" : "Network error during reconciliation" });
    } finally {
      setReconciling(false);
    }
  };

  if (loading) {
    return (
      <section className="panel rounded p-6">
        <p className="text-sm text-muted">{isFa ? "در حال دریافت تنظیمات ارائه‌دهنده..." : "Loading provider settings..."}</p>
      </section>
    );
  }

  if (!config) {
    return (
      <section className="panel rounded p-6 border border-dashed border-border/80 bg-surface/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-border/60 mb-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {isFa ? "معماری Multi-Provider و تنظیمات BoxAPI" : "Multi-Provider & BoxAPI Architecture"}
            </h2>
            <p className="text-xs text-muted mt-0.5">
              {isFa
                ? "پیکربندی استراتژی ارسال، BoxAPI به عنوان روش اصلی، هات‌فیل‌اور و حسابرسی پیام‌ها"
                : "Orchestration strategy, BoxAPI primary standalone mode, hot failover, and message audits."}
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-muted/10 text-muted border border-border mt-2 sm:mt-0">
            {isFa ? "در انتظار اتصال پیج" : "Account Required"}
          </span>
        </div>
        <div className="text-center py-6 px-4">
          <p className="text-sm font-medium text-foreground">
            {isFa
              ? "هنوز هیچ اکانت اینستاگرامی به این ورک‌اسپیس متصل نشده است."
              : "No Instagram account is connected to this workspace yet."}
          </p>
          <p className="text-xs text-muted mt-2 max-w-lg mx-auto leading-relaxed">
            {isFa
              ? "برای اینکه BoxAPI روش اصلی (Primary) شما باشد، از کادر بالای همین صفحه گزینه «اتصال با BoxAPI» را انتخاب کنید و شناسه اکانت و کلید API خود را وارد نمایید. پس از اتصال، تمام کنترل‌های پیشرفته و تست سلامت فعال خواهند شد."
              : "To make BoxAPI your primary method, select 'Connect via BoxAPI' in the card above and enter your credentials. Advanced orchestration will activate immediately."}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel rounded p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border mb-6">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {isFa ? "معماری Multi-Provider و یکپارچه‌سازی BoxAPI" : "Multi-Provider & BoxAPI Architecture"}
          </h2>
          <p className="text-xs text-muted mt-1">
            {isFa
              ? "پیکربندی عملیاتی BoxAPI و Meta: انتخاب ارائه‌دهنده اصلی، Failover خودکار و حسابرسی Zero-Lead-Loss"
              : "Enterprise multi-provider orchestration: BoxAPI standalone mode, Meta failover, and zero lead loss reconciliation."}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-3 sm:mt-0">
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              orchestrationMode === "BOXAPI_PRIMARY"
                ? "bg-purple-500/10 text-purple-400 border border-purple-500/30"
                : orchestrationMode === "SMART_HYBRID"
                ? "bg-blue-500/10 text-blue-400 border border-blue-500/30"
                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
            }`}
          >
            {orchestrationMode}
          </span>
        </div>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded text-sm border ${
            message.type === "success"
              ? "bg-success/10 border-success/30 text-success"
              : "bg-error/10 border-error/30 text-error"
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Mode Selector */}
        <div>
          <label className="block text-xs font-semibold mb-2 text-foreground">
            {isFa ? "استراتژی عملیاتی سیستم (Orchestration Mode)" : "Orchestration Strategy"}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => {
                setOrchestrationMode("BOXAPI_PRIMARY");
                setPrimaryProvider("BOXAPI");
              }}
              className={`p-3.5 rounded-lg border text-right transition-all ${
                orchestrationMode === "BOXAPI_PRIMARY"
                  ? "border-accent bg-accent/10 shadow-sm"
                  : "border-border bg-surface hover:border-border/80"
              }`}
            >
              <div className="font-semibold text-sm text-foreground">
                {isFa ? "۱. BoxAPI اصلی (مستقل)" : "1. BoxAPI Primary"}
              </div>
              <p className="text-xs text-muted mt-1">
                {isFa
                  ? "۱۰۰٪ عملیات اینستاگرام از BoxAPI بدون وابستگی به Meta عبور می‌کند."
                  : "All DM, comments, and webhooks run through BoxAPI without Meta dependency."}
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setOrchestrationMode("META_PRIMARY");
                setPrimaryProvider("META");
                setBackupProvider("BOXAPI");
              }}
              className={`p-3.5 rounded-lg border text-right transition-all ${
                orchestrationMode === "META_PRIMARY"
                  ? "border-accent bg-accent/10 shadow-sm"
                  : "border-border bg-surface hover:border-border/80"
              }`}
            >
              <div className="font-semibold text-sm text-foreground">
                {isFa ? "۲. Meta اصلی با بکاپ BoxAPI" : "2. Meta Primary + BoxAPI Backup"}
              </div>
              <p className="text-xs text-muted mt-1">
                {isFa
                  ? "عملیات از طریق Meta ارسال می‌شود و در صورت خطا فوراً به BoxAPI منتقل می‌گردد."
                  : "Runs via Meta Official API; automatically fails over to BoxAPI on outage."}
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setOrchestrationMode("SMART_HYBRID");
              }}
              className={`p-3.5 rounded-lg border text-right transition-all ${
                orchestrationMode === "SMART_HYBRID"
                  ? "border-accent bg-accent/10 shadow-sm"
                  : "border-border bg-surface hover:border-border/80"
              }`}
            >
              <div className="font-semibold text-sm text-foreground">
                {isFa ? "۳. ترکیبی هوشمند (Smart Hybrid)" : "3. Smart Hybrid"}
              </div>
              <p className="text-xs text-muted mt-1">
                {isFa
                  ? "مسیریابی بر اساس سلامت، نرخ محدودیت و قابلیت اختصاصی هر Provider."
                  : "Intelligent routing per capability, rate limit, and live provider health."}
              </p>
            </button>
          </div>
        </div>

        {/* BoxAPI Credentials */}
        <div className="border border-border rounded-lg p-4 bg-surface/50 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              {isFa ? "اطلاعات احراز هویت BoxAPI (BoxAPI Credentials)" : "BoxAPI Credentials"}
            </h3>
            <span className="text-xs text-muted">
              {config.hasBoxApiKey ? (
                <span className="text-success font-medium">✓ {isFa ? "کلید API ذخیره شده است" : "API Key Configured"}</span>
              ) : (
                <span className="text-warning font-medium">⚠ {isFa ? "کلید API وارد نشده" : "Not Configured"}</span>
              )}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1 text-foreground">
                {isFa ? "شناسه اکانت اینستاگرام در BoxAPI (account_id)" : "BoxAPI Account ID (UUID)"}
              </label>
              <input
                type="text"
                value={boxAccountId}
                onChange={(e) => setBoxAccountId(e.target.value)}
                placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-foreground">
                {isFa ? "کلید API ارسال پیام رسمی (X-Api-Key)" : "Official Actions API Key (X-Api-Key)"}
              </label>
              <input
                type="password"
                value={boxApiKey}
                onChange={(e) => setBoxApiKey(e.target.value)}
                placeholder={config.hasBoxApiKey ? "•••••••••••••••• (ذخیره شده)" : "کلید API باکس را وارد کنید"}
                className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-foreground">
                {isFa ? "توکن Data API برای بازیابی لیدها (Bearer Token)" : "Data API Token (Bearer Token)"}
              </label>
              <input
                type="password"
                value={boxApiToken}
                onChange={(e) => setBoxApiToken(e.target.value)}
                placeholder={config.hasBoxApiToken ? "•••••••••••••••• (ذخیره شده)" : "توکن Data API برای حسابرسی"}
                className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-foreground">
                {isFa ? "رمز امضای وب‌هوک BoxAPI (Webhook Secret)" : "BoxAPI Webhook Secret (HMAC SHA-256)"}
              </label>
              <input
                type="password"
                value={boxWebhookSecret}
                onChange={(e) => setBoxWebhookSecret(e.target.value)}
                placeholder={config.hasBoxWebhookSecret ? "•••••••••••••••• (ذخیره شده)" : "رمز تایید امضای وب‌هوک"}
                className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              />
            </div>
          </div>
        </div>

        {/* Telemetry and Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded text-sm font-semibold bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {saving ? (isFa ? "در حال ذخیره..." : "Saving...") : (isFa ? "ذخیره تغییرات" : "Save Settings")}
            </button>

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="px-4 py-2.5 rounded text-sm font-medium border border-border bg-surface hover:bg-surface/80 transition-colors disabled:opacity-50"
            >
              {testing ? (isFa ? "در حال تست..." : "Testing...") : (isFa ? "تست سلامت اتصال" : "Test Health")}
            </button>

            <button
              type="button"
              onClick={handleReconcile}
              disabled={reconciling}
              className="px-4 py-2.5 rounded text-sm font-medium border border-border bg-surface hover:bg-surface/80 transition-colors disabled:opacity-50"
            >
              {reconciling ? (isFa ? "در حال حسابرسی..." : "Reconciling...") : (isFa ? "حسابرسی لیدهای ازدست‌رفته" : "Run Zero-Loss Sweep")}
            </button>
          </div>

          <div className="text-xs text-muted">
            {isFa ? "تعداد Failover خودکار: " : "Failover count: "}
            <span className="font-semibold text-foreground">{config.failoverCount}</span>
            {config.lastFailoverAt && (
              <span className="mr-2">
                · {isFa ? "آخرین جابجایی: " : "Last: "}
                {new Date(config.lastFailoverAt).toLocaleTimeString(isFa ? "fa-IR" : "en-US")}
              </span>
            )}
          </div>
        </div>
      </form>
    </section>
  );
}
