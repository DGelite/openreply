"use client";

import { useEffect, useState } from "react";
import type { AccountOption } from "@/components/account-select";
import { useLanguage } from "@/context/language-context";
import { ProviderSettingsCard } from "@/components/settings/provider-settings-card";
import { AiProviderCard } from "@/components/settings/ai-provider-card";
import { AiPersonaCard } from "@/components/settings/ai-persona-card";
import { OperatingScheduleCard } from "@/components/settings/operating-schedule-card";
import { KnowledgeBaseCard } from "@/components/settings/knowledge-base-card";

interface SettingsData {
  workspace: {
    name: string;
    dmsSentThisPeriod: number;
  };
  instagramAccount: {
    id: string;
    username: string;
    instagramId: string;
    tokenExpiresAt: string | null;
    webhookSubscribed: boolean;
    primaryProvider?: "META" | "BOXAPI";
    orchestrationMode?: string;
    boxAccountId?: string | null;
  } | null;
  instagramAccounts: Array<
    AccountOption & {
      tokenExpiresAt: string | null;
      webhookSubscribed: boolean;
      primaryProvider?: "META" | "BOXAPI";
      orchestrationMode?: string;
      boxAccountId?: string | null;
      boxConnectedAt?: string | null;
    }
  >;
}

interface WorkspaceMembersData {
  currentUserRole: "OWNER" | "ADMIN" | "MEMBER";
  members: Array<{
    id: string;
    role: "OWNER" | "ADMIN" | "MEMBER";
    createdAt: string;
    user: {
      id: string;
      email: string | null;
      name: string | null;
    };
  }>;
  invitations: Array<{
    id: string;
    email: string;
    role: "OWNER" | "ADMIN" | "MEMBER";
    inviteUrl: string;
    expiresAt: string;
  }>;
}

export default function SettingsPage() {
  const { language } = useLanguage();
  const isFa = language === "fa";

  const [data, setData] = useState<SettingsData | null>(null);
  const [membersData, setMembersData] = useState<WorkspaceMembersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [memberError, setMemberError] = useState<string | null>(null);

  const [alertMessage, setAlertMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Direct BoxAPI connection state
  const [connectMethod, setConnectMethod] = useState<"BOXAPI" | "META">("BOXAPI");
  const [boxUsername, setBoxUsername] = useState("");
  const [boxAccountId, setBoxAccountId] = useState("");
  const [boxApiKey, setBoxApiKey] = useState("");
  const [boxApiToken, setBoxApiToken] = useState("");
  const [boxWebhookSecret, setBoxWebhookSecret] = useState("");
  const [showAdvancedBox, setShowAdvancedBox] = useState(false);
  const [boxConnecting, setBoxConnecting] = useState(false);
  const [boxConnectError, setBoxConnectError] = useState<string | null>(null);
  const [boxConnectSuccess, setBoxConnectSuccess] = useState<string | null>(null);
  const [showConnectForm, setShowConnectForm] = useState(false);

  async function handleConnectBoxApi(e: React.FormEvent) {
    e.preventDefault();
    setBoxConnecting(true);
    setBoxConnectError(null);
    setBoxConnectSuccess(null);

    try {
      const res = await fetch("/api/instagram/connect-boxapi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: boxUsername,
          boxAccountId,
          boxApiKey,
          boxApiToken: boxApiToken.trim() || undefined,
          boxWebhookSecret: boxWebhookSecret.trim() || undefined,
        }),
      });

      const payload = await res.json();
      if (payload.success) {
        setBoxConnectSuccess(
          payload.message ||
            (isFa
              ? "پیج با موفقیت از طریق BoxAPI متصل شد و به عنوان روش اصلی فعال گردید!"
              : "Instagram account connected via BoxAPI successfully!")
        );
        setBoxUsername("");
        setBoxAccountId("");
        setBoxApiKey("");
        setBoxApiToken("");
        setBoxWebhookSecret("");
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        setBoxConnectError(
          payload.error || (isFa ? "خطا در اتصال پیج با BoxAPI" : "Failed to connect BoxAPI")
        );
      }
    } catch {
      setBoxConnectError(isFa ? "خطای ارتباط با سرور" : "Network error");
    } finally {
      setBoxConnecting(false);
    }
  }

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const instagramStatus = searchParams.get("instagram");
    if (instagramStatus === "connected") {
      setAlertMessage({
        type: "success",
        text: isFa ? "اکانت اینستاگرام با موفقیت متصل شد." : "Instagram account connected successfully.",
      });
    } else if (instagramStatus === "already_connected") {
      setAlertMessage({
        type: "success",
        text: isFa ? "این اکانت اینستاگرام قبلاً به ورک‌اسپیس شما متصل شده است." : "This Instagram account is already connected to your workspace.",
      });
    } else if (instagramStatus === "failed" || instagramStatus === "invalid" || instagramStatus === "denied") {
      setAlertMessage({
        type: "error",
        text: isFa ? "خطا در اتصال به اینستاگرام. لطفاً مجدداً تلاش کنید." : "Instagram connection failed. Please try again.",
      });
    }

    Promise.all([
      fetch("/api/dashboard/stats").then((res) => res.json()),
      fetch("/api/workspace/members").then((res) => res.json()),
    ])
      .then(([statsPayload, membersPayload]) => {
        if (statsPayload.success) setData(statsPayload.data);
        if (membersPayload.success) setMembersData(membersPayload.data);
      })
      .finally(() => setLoading(false));
  }, [isFa]);

  async function refreshMembers() {
    const res = await fetch("/api/workspace/members");
    const payload = await res.json();
    if (payload.success) setMembersData(payload.data);
  }

  async function disconnectInstagram(instagramAccountId: string) {
    const promptMsg = isFa
      ? "آیا از قطع اتصال اینستاگرام اطمینان دارید؟ ارسال دایرکت در کمپین‌های این اکانت متوقف خواهد شد."
      : "Disconnect Instagram? Campaigns for this account will stop sending DMs.";
    if (!confirm(promptMsg)) return;

    setBusy(`disconnect:${instagramAccountId}`);
    await fetch("/api/instagram/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instagramAccountId }),
    });
    window.location.reload();
  }

  async function inviteMember(event: React.FormEvent) {
    event.preventDefault();
    setMemberError(null);
    setBusy("invite");
    const res = await fetch("/api/workspace/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });
    const payload = await res.json();
    if (payload.success) {
      setMembersData(payload.data);
      setInviteEmail("");
    } else {
      setMemberError(payload.error ?? (isFa ? "امکان ارسال دعوت‌نامه وجود ندارد" : "Could not invite member"));
    }
    setBusy(null);
  }

  async function removeInvitation(invitationId: string) {
    setBusy(`invite:${invitationId}`);
    await fetch("/api/workspace/members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitationId }),
    });
    await refreshMembers();
    setBusy(null);
  }

  if (loading) {
    return <div className="panel rounded p-8 h-64 animate-pulse bg-surface/50 max-w-2xl mx-auto" />;
  }

  const accounts = data?.instagramAccounts ?? [];
  const canManageMembers =
    membersData?.currentUserRole === "OWNER" ||
    membersData?.currentUserRole === "ADMIN";

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {alertMessage && (
        <div
          className={`p-4 rounded border text-sm font-medium ${
            alertMessage.type === "success"
              ? "bg-success/10 border-success/30 text-success"
              : "bg-error/10 border-error/30 text-error"
          }`}
        >
          {alertMessage.text}
        </div>
      )}

      {/* Instagram Connection */}
      <section className="panel rounded p-6">
        <h2 className="text-base font-semibold mb-6 text-foreground">
          {isFa ? "اتصال اکانت اینستاگرام (Instagram Connection)" : "Instagram Connection"}
        </h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="text-sm font-medium text-foreground">{isFa ? "وضعیت اتصال" : "Status"}</p>
              <p className="text-xs text-muted mt-0.5">
                {isFa
                  ? "وب‌هوک کامنت‌ها و ارسال دایرکت‌های هوشمند به این اتصال وابسته است."
                  : "Comment webhooks and private replies depend on this connection."}
              </p>
            </div>
            <span
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                accounts.length > 0
                  ? "bg-success/10 text-success"
                  : "bg-warning/10 text-warning"
              }`}
            >
              {accounts.length > 0 ? (isFa ? "متصل شده" : "Connected") : (isFa ? "غیرمتصل" : "Not connected")}
            </span>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="text-sm font-medium text-foreground">{isFa ? "اکانت‌های متصل" : "Connected Accounts"}</p>
              <p className="text-xs text-muted mt-0.5">
                {accounts.length} {isFa ? "پروفایل متصل اینستاگرام" : "connected Instagram profile(s)"}
              </p>
            </div>
            <span className="text-sm text-muted">
              {accounts.length > 0 ? `${accounts.length} ${isFa ? "اکانت" : "connected"}` : (isFa ? "هیچ" : "None")}
            </span>
          </div>

          <div className="space-y-3 py-3">
            {accounts.length === 0 && (
              <p className="text-sm text-muted">
                {isFa ? "برای راه‌اندازی کمپین‌ها، یک اکانت تجاری اینستاگرام متصل کنید." : "Connect an Instagram professional account to launch campaigns."}
              </p>
            )}
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex flex-col gap-3 rounded border border-border bg-surface/70 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      @{account.username}
                    </p>
                    {account.primaryProvider === "BOXAPI" ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30">
                        {isFa ? "BoxAPI (روش اصلی / مستقل)" : "BoxAPI Primary"}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                        Meta API
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {account.primaryProvider === "BOXAPI" ? (
                      <>
                        {isFa ? "روش ارسال: ۱۰۰٪ BoxAPI" : "Delivery: 100% BoxAPI"}
                        {account.boxAccountId ? ` · ${isFa ? "شناسه: " : "ID: "}${account.boxAccountId}` : ""}{" "}
                        · {account.webhookSubscribed ? (isFa ? "وب‌هوک فعال" : "Webhook ready") : (isFa ? "در انتظار وب‌هوک" : "Webhook pending")}
                      </>
                    ) : (
                      <>
                        {isFa ? "انقضای توکن: " : "Token expires "}
                        {account.tokenExpiresAt
                          ? new Date(account.tokenExpiresAt).toLocaleDateString(isFa ? "fa-IR" : "en-US")
                          : (isFa ? "نامشخص" : "not available")}{" "}
                        · {account.webhookSubscribed ? (isFa ? "وب‌هوک فعال" : "Webhook ready") : (isFa ? "در انتظار وب‌هوک" : "Webhook pending")}
                      </>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => disconnectInstagram(account.id)}
                  disabled={busy === `disconnect:${account.id}`}
                  className="inline-flex items-center justify-center rounded border border-error/20 px-4 py-2 text-sm font-medium text-error transition-all hover:border-error/40 hover:bg-error/10 disabled:opacity-50"
                >
                  {busy === `disconnect:${account.id}`
                    ? (isFa ? "در حال قطع اتصال..." : "Disconnecting...")
                    : (isFa ? "قطع اتصال" : "Disconnect")}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Method selector and connect container */}
        <div className="mt-6 pt-5 border-t border-border space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {accounts.length > 0
                  ? (isFa ? "اتصال اکانت جدید یا تغییر متد" : "Connect Account / Change Method")
                  : (isFa ? "روش اتصال به اینستاگرام را انتخاب کنید" : "Choose Connection Method")}
              </p>
              <p className="text-xs text-muted mt-0.5">
                {isFa
                  ? "می‌توانید مستقیماً با BoxAPI متصل شوید (بدون فیسبوک) یا از Meta OAuth رسمی استفاده نمایید."
                  : "Connect standalone via BoxAPI (no Facebook needed) or use Meta OAuth."}
              </p>
            </div>
            {accounts.length > 0 && !showConnectForm && (
              <button
                type="button"
                onClick={() => setShowConnectForm(true)}
                className="px-3.5 py-1.5 rounded text-xs font-semibold border border-border bg-surface hover:bg-surface/80 text-foreground"
              >
                {isFa ? "+ اتصال پیج یا روش دیگر" : "+ Connect another"}
              </button>
            )}
          </div>

          {(accounts.length === 0 || showConnectForm) && (
            <div className="rounded-lg border border-border bg-surface/50 p-4 space-y-4">
              {/* Method Tabs */}
              <div className="flex border-b border-border gap-2 pb-2">
                <button
                  type="button"
                  onClick={() => setConnectMethod("BOXAPI")}
                  className={`pb-2 px-3 text-xs font-semibold transition-all border-b-2 -mb-[9px] ${
                    connectMethod === "BOXAPI"
                      ? "border-accent text-accent"
                      : "border-transparent text-muted hover:text-foreground"
                  }`}
                >
                  {isFa ? "۱. اتصال با BoxAPI (روش اصلی و مستقل)" : "1. Connect via BoxAPI (Standalone)"}
                </button>
                <button
                  type="button"
                  onClick={() => setConnectMethod("META")}
                  className={`pb-2 px-3 text-xs font-semibold transition-all border-b-2 -mb-[9px] ${
                    connectMethod === "META"
                      ? "border-accent text-accent"
                      : "border-transparent text-muted hover:text-foreground"
                  }`}
                >
                  {isFa ? "۲. اتصال رسمی Meta (فیسبوک)" : "2. Meta Official OAuth"}
                </button>
              </div>

              {connectMethod === "BOXAPI" ? (
                <form onSubmit={handleConnectBoxApi} className="space-y-4 pt-2">
                  <div className="p-3 rounded bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300">
                    {isFa
                      ? "⚡ این متد به فیسبوک لاگین نیازی ندارد. تمام پیام‌ها، دایرکت‌ها و وب‌هوک‌ها مستقیماً با کلید BoxAPI کار می‌کنند و پیج به صورت روش اصلی (Primary) تنظیم می‌شود."
                      : "⚡ No Facebook login required. Direct messages, comment replies, and webhooks run directly via BoxAPI."}
                  </div>

                  {boxConnectError && (
                    <div className="p-3 rounded bg-error/10 border border-error/20 text-xs text-error font-medium">
                      {boxConnectError}
                    </div>
                  )}

                  {boxConnectSuccess && (
                    <div className="p-3 rounded bg-success/10 border border-success/20 text-xs text-success font-medium">
                      {boxConnectSuccess}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">
                        {isFa ? "نام کاربری پیج اینستاگرام (بدون @)" : "Instagram Username (without @)"}
                        <span className="text-error mr-1">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={boxUsername}
                        onChange={(e) => setBoxUsername(e.target.value)}
                        placeholder="e.g. your_brand"
                        className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">
                        {isFa ? "شناسه اکانت در BoxAPI (Account ID / UUID)" : "BoxAPI Account ID (UUID)"}
                        <span className="text-error mr-1">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={boxAccountId}
                        onChange={(e) => setBoxAccountId(e.target.value)}
                        placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                        className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      {isFa ? "کلید API رسمی پیام‌رسانی BoxAPI (X-Api-Key)" : "BoxAPI Messaging API Key (X-Api-Key)"}
                      <span className="text-error mr-1">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      value={boxApiKey}
                      onChange={(e) => setBoxApiKey(e.target.value)}
                      placeholder="کلید API دریافت شده از پنل boxapi.ir"
                      className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                    />
                  </div>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAdvancedBox(!showAdvancedBox)}
                      className="text-xs text-accent hover:underline flex items-center gap-1"
                    >
                      {showAdvancedBox
                        ? (isFa ? "− بستن تنظیمات اختیاری" : "− Hide optional settings")
                        : (isFa ? "+ نمایش تنظیمات اختیاری (توکن دیتا و سکرت وب‌هوک)" : "+ Optional: Data API Token & Webhook Secret")}
                    </button>
                  </div>

                  {showAdvancedBox && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded border border-border/70 bg-surface/70">
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">
                          {isFa ? "توکن Data API (اختیاری برای اسکرپ کامنت)" : "Data API Token (Bearer)"}
                        </label>
                        <input
                          type="password"
                          value={boxApiToken}
                          onChange={(e) => setBoxApiToken(e.target.value)}
                          placeholder="Bearer token for reconciliation"
                          className="w-full rounded border border-border bg-surface px-3 py-1.5 text-xs text-foreground outline-none focus:border-accent"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">
                          {isFa ? "کلید سکرت امضای وب‌هوک (اختیاری)" : "Webhook Secret (HMAC-SHA256)"}
                        </label>
                        <input
                          type="password"
                          value={boxWebhookSecret}
                          onChange={(e) => setBoxWebhookSecret(e.target.value)}
                          placeholder="Secret for webhook signature"
                          className="w-full rounded border border-border bg-surface px-3 py-1.5 text-xs text-foreground outline-none focus:border-accent"
                        />
                      </div>
                    </div>
                  )}

                  {/* Webhook URL Helper */}
                  <div className="p-3 rounded bg-surface border border-border text-xs space-y-1">
                    <span className="text-muted block">
                      {isFa
                        ? "🔗 آدرس وب‌هوک جهت ثبت در داشبورد BoxAPI:"
                        : "🔗 Webhook URL to configure in your BoxAPI dashboard:"}
                    </span>
                    <code className="text-foreground font-mono bg-surface-hover px-2 py-1 rounded block select-all text-[11px] overflow-x-auto">
                      https://insta.digitalelite.ir/api/webhook/boxapi
                    </code>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={boxConnecting}
                      className="px-4 py-2 rounded text-sm font-medium transition-colors bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
                    >
                      {boxConnecting
                        ? (isFa ? "در حال اتصال به BoxAPI..." : "Connecting...")
                        : (isFa ? "اتصال پیج و تنظیم BoxAPI به عنوان روش اصلی" : "Connect & Make BoxAPI Primary")}
                    </button>
                    {accounts.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowConnectForm(false)}
                        className="px-3 py-2 rounded text-sm font-medium text-muted hover:text-foreground"
                      >
                        {isFa ? "انصراف" : "Cancel"}
                      </button>
                    )}
                  </div>
                </form>
              ) : (
                <div className="space-y-4 pt-2">
                  <p className="text-xs text-muted leading-relaxed">
                    {isFa
                      ? "با کلیک روی دکمه زیر، به صفحه رسمی لاگین فیسبوک هدایت می‌شوید تا دسترسی‌های اینستاگرام را اعطا کنید. این روش نیازمند اپلیکیشن تأیید شده متا است."
                      : "Redirects to official Facebook login to authorize Instagram Graph API permissions."}
                  </p>
                  <div className="flex items-center gap-3">
                    <a
                      href="/api/instagram/connect"
                      className="px-4 py-2 rounded text-sm font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700"
                    >
                      {isFa ? "ورود با فیسبوک و اتصال Meta" : "Connect via Facebook Login"}
                    </a>
                    {accounts.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowConnectForm(false)}
                        className="px-3 py-2 rounded text-sm font-medium text-muted hover:text-foreground"
                      >
                        {isFa ? "انصراف" : "Cancel"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Multi-Provider & BoxAPI Architecture Settings */}
      <ProviderSettingsCard accountId={accounts[0]?.id} />

      {/* AI Provider Engine, Official APIs & BoxAPI AI Settings */}
      <AiProviderCard />

      {/* AI Persona, Conversation Goals & Objection Policies */}
      <AiPersonaCard />

      {/* Operating Schedule, Active Working Hours & Holidays */}
      <OperatingScheduleCard accountId={accounts[0]?.id} />

      {/* RAG Business Knowledge Base */}
      <KnowledgeBaseCard />

      {/* Team Management */}
      <section className="panel rounded p-6">
        <h2 className="text-base font-semibold mb-6 text-foreground">{isFa ? "مدیریت اعضای تیم (Team)" : "Team"}</h2>
        <div className="space-y-3">
          {membersData?.members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {member.user.name ?? member.user.email ?? (isFa ? "عضو ناشناس" : "Unknown member")}
                </p>
                <p className="text-xs text-muted">{member.user.email}</p>
              </div>
              <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted">
                {member.role}
              </span>
            </div>
          ))}
        </div>

        {canManageMembers && (
          <form
            onSubmit={inviteMember}
            className="mt-6 grid gap-3 border-t border-border pt-4 sm:grid-cols-[1fr_140px_auto]"
          >
            <input
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="teammate@agency.com"
              className="rounded border border-border bg-surface px-4 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent/40"
              required
            />
            <select
              value={inviteRole}
              onChange={(event) =>
                setInviteRole(event.target.value as "ADMIN" | "MEMBER")
              }
              className="rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent/40"
            >
              <option value="MEMBER">{isFa ? "عضو عادی" : "Member"}</option>
              <option value="ADMIN">{isFa ? "مدیر (Admin)" : "Admin"}</option>
            </select>
            <button
              type="submit"
              disabled={busy === "invite"}
              className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {busy === "invite" ? (isFa ? "در حال ارسال..." : "Inviting...") : (isFa ? "دعوت عضو جدید" : "Invite")}
            </button>
          </form>
        )}
      </section>

      {/* PHP CRM Integration */}
      <section className="panel rounded p-6">
        <h2 className="text-base font-semibold mb-2 text-foreground">
          {isFa ? "یکپارچه‌سازی با PHP CRM و سیستم رزرو" : "PHP CRM & Booking Integration"}
        </h2>
        <p className="text-xs text-muted mb-6">
          {isFa
            ? "اتصال به سرور PHP (تنظیم شده در فایل env) — یکپارچه‌سازی اتوماتیک رزرو نوبت و CRM"
            : "Connect to PHP server (configured in .env) for automated appointment booking & CRM sync."}
        </p>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy("test_booking_api");
            setMemberError(null);
            try {
              const formData = new FormData(e.currentTarget);
              const apiUrl = formData.get("apiUrl") as string;
              const apiSecret = formData.get("apiSecret") as string;

              const res = await fetch("/api/settings/booking", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ apiUrl, apiSecret }),
              });
              const payload = await res.json();

              if (payload.success) {
                setAlertMessage({ type: "success", text: `✅ ${payload.message}` });
              } else {
                setMemberError(payload.error || (isFa ? "خطا در برقراری ارتباط" : "Failed to connect"));
              }
            } catch {
              setMemberError(isFa ? "خطا در ارسال درخواست برقراری ارتباط" : "Error sending test request");
            } finally {
              setBusy(null);
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold mb-1 text-foreground">
              {isFa ? "آدرس سرور PHP (Booking Gateway URL)" : "PHP Server URL (admin.php)"}
            </label>
            <input
              type="text"
              name="apiUrl"
              defaultValue={process.env.NEXT_PUBLIC_BOOKING_API_URL || process.env.NEXT_PUBLIC_PHP_ADMIN_API_URL || "http://localhost/admin.php"}
              placeholder="http://localhost/admin.php"
              className="w-full rounded border border-border bg-surface px-4 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent/40"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 text-foreground">
              {isFa ? "کلید راز امنیتی (HMAC API Secret Key)" : "HMAC API Secret Key"}
            </label>
            <input
              type="password"
              name="apiSecret"
              defaultValue=""
              placeholder="••••••••"
              className="w-full rounded border border-border bg-surface px-4 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent/40"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="submit"
              disabled={busy === "test_booking_api"}
              className="px-4 py-2 rounded text-sm font-semibold transition-colors bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {busy === "test_booking_api"
                ? (isFa ? "در حال تست و بررسی..." : "Testing Connection...")
                : (isFa ? "تست و بررسی برقراری ارتباط" : "Test & Verify Gateway")}
            </button>
            <span className="text-xs text-muted font-medium">
              📁 {isFa ? "آدرس سرور (نیاز به تنظیم در .env دارد)" : "Server URL (configure in .env)"}
            </span>
          </div>
        </form>
      </section>

      {/* SMS Gateway Integration */}
      <section className="panel rounded p-6">
        <h2 className="text-base font-semibold mb-2 text-foreground">
          {isFa ? "درگاه پیامک sms.ir (SMS Gateway Integration)" : "sms.ir SMS Gateway Integration"}
        </h2>
        <p className="text-xs text-muted mb-6">
          {isFa
            ? "ارسال اتوماتیک پیامک پترن و OTP برای لیدها از طریق اتصال مستقیم یا واسط سرور رزرو"
            : "Configure automatic SMS & OTP verification dispatching for captured leads."}
        </p>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy("test_sms_api");
            setMemberError(null);
            try {
              const formData = new FormData(e.currentTarget);
              const mode = formData.get("mode") as string;
              const apiKey = formData.get("apiKey") as string;
              const lineNumber = formData.get("lineNumber") as string;
              const templateId = formData.get("templateId") as string;

              const res = await fetch("/api/settings/sms", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode, apiKey, lineNumber, templateId, testReceptor: "09120000000" }),
              });
              const payload = await res.json();

              if (payload.success) {
                alert(`✅ ${payload.message}`);
              } else {
                setMemberError(payload.error || (isFa ? "خطا در بررسی سامانه پیامک" : "SMS gateway check failed"));
              }
            } catch {
              setMemberError(isFa ? "خطا در برقراری ارتباط با سامانه پیامک" : "Connection error to SMS gateway");
            } finally {
              setBusy(null);
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold mb-1 text-foreground">
              {isFa ? "حالت کارکرد سامانه (Integration Mode)" : "Integration Mode"}
            </label>
            <select
              name="mode"
              defaultValue={process.env.NEXT_PUBLIC_SMS_INTEGRATION_MODE || "HYBRID"}
              className="w-full rounded border border-border bg-surface px-4 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent/40"
            >
              <option value="HYBRID">
                {isFa ? "ترکیبی / هوشمند (مستقیم sms.ir با پشتیبان سرور PHP)" : "Hybrid (Direct sms.ir with PHP fallback)"}
              </option>
              <option value="DIRECT">
                {isFa ? "مستقیم (اتصال مستقیم OpenReply به API سامانه sms.ir)" : "Direct (OpenReply API call to sms.ir)"}
              </option>
              <option value="PHP_PROXY">
                {isFa ? "واسط سرور رزرو (ارسال از طریق درگاه PHP CRM)" : "PHP Proxy (Routed via CRM server)"}
              </option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1 text-foreground">
                {isFa ? "کلید API سامانه (sms.ir X-API-KEY)" : "sms.ir X-API-KEY"}
              </label>
              <input
                type="password"
                name="apiKey"
                defaultValue={process.env.NEXT_PUBLIC_SMS_IR_API_KEY || ""}
                placeholder="x-api-key..."
                className="w-full rounded border border-border bg-surface px-4 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent/40"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-foreground">
                {isFa ? "شماره خط اختصاصی (مخصوص ارسال‌های غیرپترن)" : "Dedicated Line Number"}
              </label>
              <input
                type="text"
                name="lineNumber"
                defaultValue={process.env.NEXT_PUBLIC_SMS_IR_LINE_NUMBER || "3000..."}
                placeholder="3000..."
                className="w-full rounded border border-border bg-surface px-4 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent/40"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 text-foreground">
              {isFa ? "شناسه قالب پترن تاییدیه (OTP Template ID)" : "OTP Template ID"}
            </label>
            <input
              type="text"
              name="templateId"
              defaultValue={process.env.NEXT_PUBLIC_SMS_IR_TEMPLATE_ID || "100000"}
              placeholder="100000"
              className="w-full rounded border border-border bg-surface px-4 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent/40"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="submit"
              disabled={busy === "test_sms_api"}
              className="px-4 py-2 rounded text-sm font-semibold transition-colors bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {busy === "test_sms_api"
                ? (isFa ? "در حال تست سامانه..." : "Testing SMS Gateway...")
                : (isFa ? "تست سامانه و استعلام اعتبار" : "Test Gateway & Check Balance")}
            </button>
            <span className="text-xs text-success font-medium">
              🟢 {isFa ? "درگاه sms.ir فعال و آماده ارسال" : "sms.ir Gateway Active"}
            </span>
          </div>
        </form>
      </section>

      {/* Usage Stats */}
      <section className="panel rounded p-6">
        <h2 className="text-base font-semibold mb-6 text-foreground">{isFa ? "میزان مصرف" : "Usage"}</h2>
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              {isFa ? "پیام‌های ارسال‌شده در این ماه" : "DMs sent this month"}
            </p>
            <p className="text-xs text-muted mt-0.5">
              {isFa ? "میزبانی اختصاصی — بدون محدودیت پلن" : "Self-hosted — no plan limits."}
            </p>
          </div>
          <span className="text-sm font-semibold text-foreground">
            {data?.workspace.dmsSentThisPeriod ?? 0}
          </span>
        </div>
      </section>
    </div>
  );
}
