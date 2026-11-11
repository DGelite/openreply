"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/context/language-context";

interface BookingConfig {
  apiUrl: string;
  apiSecret: string;
  isConfigured: boolean;
  isConnected: boolean;
  serverTime?: string;
  webhookUrl: string;
  enabled: boolean;
}

export function BookingSettingsCard() {
  const { language } = useLanguage();
  const isFa = language === "fa";

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [config, setConfig] = useState<BookingConfig | null>(null);
  const [apiUrl, setApiUrl] = useState("https://armintahmasebi.ir/api_openreply.php");
  const [apiSecret, setApiSecret] = useState("");
  const [status, setStatus] = useState<"idle" | "connected" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/settings/booking");
      const payload = await res.json();
      if (payload.success && payload.data) {
        setConfig(payload.data);
        if (payload.data.apiUrl) {
          setApiUrl(payload.data.apiUrl);
        }
        if (payload.data.isConnected) {
          setStatus("connected");
          setStatusMessage(
            isFa
              ? `ارتباط با سرور رزرواسیون آنلاین است (زمان سرور: ${payload.data.serverTime || "فعال"})`
              : `Reservation Gateway is online (Server time: ${payload.data.serverTime || "active"})`
          );
        } else {
          setStatus("idle");
        }
      }
    } catch (err) {
      console.error("Failed to load booking settings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleTestAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/settings/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiUrl, apiSecret }),
      });
      const payload = await res.json();

      if (payload.success) {
        setStatus("connected");
        setStatusMessage(payload.message);
        if (payload.data?.normalizedUrl) {
          setApiUrl(payload.data.normalizedUrl);
        }
      } else {
        setStatus("error");
        setStatusMessage(
          payload.error ||
            (isFa
              ? "عدم برقراری ارتباط با درگاه رزرواسیون. لطفاً کلید امنیتی و آدرس سرور را بررسی فرمایید."
              : "Failed to connect to Booking Gateway. Please check URL and secret.")
        );
      }
    } catch {
      setStatus("error");
      setStatusMessage(
        isFa
          ? "خطا در ارسال درخواست تست به سرور رزرواسیون."
          : "Network request error while testing reservation gateway."
      );
    } finally {
      setBusy(false);
    }
  };

  const copyWebhookUrl = () => {
    const targetUrl = config?.webhookUrl || "https://insta.digitalelite.ir/api/webhook/php-booking";
    navigator.clipboard.writeText(targetUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2500);
  };

  const webhookDisplayUrl =
    config?.webhookUrl || "https://insta.digitalelite.ir/api/webhook/php-booking";

  return (
    <section className="panel rounded p-6">
      {/* Header & Status Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">
              {isFa
                ? "اتصال به سیستم رزرواسیون و CRM دیجیتال الیت"
                : "PHP Booking & CRM Integration"}
            </h2>
            {status === "connected" ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {isFa ? "ارتباط زنده برقرار است" : "Online & Synchronized"}
              </span>
            ) : status === "error" ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                {isFa ? "عدم برقراری ارتباط" : "Connection Failed"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-500/10 text-neutral-400 border border-neutral-500/20">
                {isFa ? "آماده اعتبارسنجی" : "Ready to Verify"}
              </span>
            )}
          </div>
          <p className="text-xs text-muted mt-1">
            {isFa
              ? "برقراری ارتباط دوطرفه با سرور مرکزی دیجیتال الیت جهت بررسی اسلات‌های خالی، ثبت لید در CRM و رزرو مستقیم از اینستاگرام."
              : "Two-way integration between Instagram DM automation and Digital Elite core reservation engine."}
          </p>
        </div>
      </div>

      {/* Live Feedback Alert */}
      {statusMessage && (
        <div
          className={`mb-5 p-3 rounded text-xs flex items-center gap-2 border ${
            status === "connected"
              ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-300"
              : status === "error"
              ? "bg-red-950/30 border-red-500/30 text-red-300"
              : "bg-surface border-border text-foreground"
          }`}
        >
          <span>{status === "connected" ? "✅" : status === "error" ? "❌" : "ℹ️"}</span>
          <span className="font-medium">{statusMessage}</span>
        </div>
      )}

      {/* Webhook Sync Box (Booking -> OpenReply) */}
      <div className="mb-6 p-4 rounded bg-surface/50 border border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <span>📡</span>
              <span>
                {isFa
                  ? "آدرس وب‌هوک OpenReply (جهت ثبت در تنظیمات armintahmasebi.ir)"
                  : "OpenReply Inbound Webhook (Enter into armintahmasebi.ir settings)"}
              </span>
            </div>
            <p className="text-[11px] text-muted mt-1 leading-relaxed">
              {isFa
                ? "این آدرس را در پنل رزرواسیون (https://armintahmasebi.ir/admin.php#settings) در کادر «آدرس وب‌هوک OpenReply» قرار دهید تا رویدادهای رزرو نوبت به صورت لحظه‌ای به ربات مخابره شوند."
                : "Copy this URL into the Booking Admin panel under OpenReply Webhook to receive instant booking events."}
            </p>
          </div>
          <button
            type="button"
            onClick={copyWebhookUrl}
            className="shrink-0 px-3 py-1.5 rounded text-xs font-medium border border-border bg-surface hover:bg-surface-hover text-foreground transition-colors flex items-center gap-1.5 self-start sm:self-center"
          >
            {copiedWebhook ? (
              <>
                <span className="text-emerald-400">✓</span>
                <span>{isFa ? "کپی شد" : "Copied"}</span>
              </>
            ) : (
              <>
                <span>📋</span>
                <span>{isFa ? "کپی آدرس وب‌هوک" : "Copy Webhook"}</span>
              </>
            )}
          </button>
        </div>
        <div className="mt-2.5 font-mono text-xs px-3 py-2 rounded bg-black/30 border border-border/60 text-accent break-all select-all">
          {webhookDisplayUrl}
        </div>
      </div>

      {/* Main Connection Form (OpenReply -> Booking) */}
      <form onSubmit={handleTestAndSave} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold mb-1 text-foreground">
            {isFa
              ? "آدرس درگاه وب‌سرویس رزرواسیون (Booking API Gateway URL)"
              : "Booking API Gateway URL (api_openreply.php)"}
          </label>
          <input
            type="url"
            name="apiUrl"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="https://armintahmasebi.ir/api_openreply.php"
            className="w-full rounded border border-border bg-surface px-4 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent/40 font-mono text-xs"
            required
            dir="ltr"
          />
          <span className="text-[11px] text-muted mt-1 block">
            {isFa
              ? "⚠️ توجه: آدرس باید به درگاه api_openreply.php اشاره کند (نه صفحه ورود ادمین admin.php)."
              : "Target endpoint must be api_openreply.php rather than admin.php."}
          </span>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1 text-foreground">
            {isFa
              ? "کلید راز امنیتی درگاه (HMAC API Secret Key)"
              : "HMAC API Secret Key"}
          </label>
          <input
            type="password"
            name="apiSecret"
            value={apiSecret}
            onChange={(e) => setApiSecret(e.target.value)}
            placeholder={
              config?.isConfigured
                ? "•••••••• (کلید امنیتی فعال در سرور تنظیم شده است)"
                : "کلید مشترک امنیتی را وارد کنید"
            }
            className="w-full rounded border border-border bg-surface px-4 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent/40 font-mono text-xs"
            dir="ltr"
          />
          <span className="text-[11px] text-muted mt-1 block">
            {isFa
              ? "در صورتی که فیلد خالی بماند، کلید امنیتی تنظیم‌شده در سرور (.env) به صورت خودکار استفاده می‌شود."
              : "Leave empty to use configured PHP_ADMIN_API_SECRET from environment."}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <button
            type="submit"
            disabled={busy || loading}
            className="px-5 py-2 rounded text-xs font-semibold transition-colors bg-accent text-white hover:bg-accent-hover disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{isFa ? "در حال تست و اعتبارسنجی..." : "Testing Gateway..."}</span>
              </>
            ) : (
              <>
                <span>⚡</span>
                <span>
                  {isFa ? "تست زنده و اعتبارسنجی اتصال" : "Test & Verify Gateway"}
                </span>
              </>
            )}
          </button>
          <span className="text-[11px] text-muted">
            📍 {isFa ? "هدف سرور: armintahmasebi.ir" : "Target: armintahmasebi.ir"}
          </span>
        </div>
      </form>
    </section>
  );
}
