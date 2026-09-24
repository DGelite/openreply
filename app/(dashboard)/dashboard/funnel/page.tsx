"use client";

import React, { useEffect, useState } from "react";
import StatCard from "@/components/stat-card";
import { useLanguage } from "@/context/language-context";

interface FunnelData {
  stageCounts: Record<string, number>;
  overallConversionRate: number;
}

const STAGE_LABELS_FA: Record<string, string> = {
  TRIGGERED: "۱. ورود به اتوماسیون (ارسال کلمه کلیدی / کامنت)",
  OPENING_DM_SENT: "۲. ارسال دایرکت اولیه",
  MAIN_DM_SENT: "۳. ارسال پیام و لینک اصلی",
  EMAIL_CAPTURED: "۴. دریافت ایمیل مخاطب",
  PHONE_CAPTURED: "۵. دریافت شماره موبایل مخاطب",
  COMPLETED: "۶. تکمیل موفق اتوماسیون",
  CONVERTED: "۷. ثبت نهایی رزرو / فروش (تبدیل نهایی)",
};

const STAGE_LABELS_EN: Record<string, string> = {
  TRIGGERED: "1. Automation Triggered (Keyword / Comment)",
  OPENING_DM_SENT: "2. Initial Opening DM Sent",
  MAIN_DM_SENT: "3. Main DM & Link Sent",
  EMAIL_CAPTURED: "4. User Email Captured",
  PHONE_CAPTURED: "5. User Phone Captured",
  COMPLETED: "6. Automation Successfully Completed",
  CONVERTED: "7. Final Conversion (Booking / Sale)",
};

export default function FunnelAnalyticsPage() {
  const { language } = useLanguage();
  const isFa = language === "fa";

  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFunnel();
  }, []);

  async function fetchFunnel() {
    try {
      const res = await fetch("/api/dashboard/funnel");
      const json = await res.json();
      if (json.stageCounts) {
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load funnel analytics:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="panel rounded p-8 h-64 animate-pulse bg-surface/50 max-w-5xl mx-auto" />;
  }

  const triggeredCount = data?.stageCounts["TRIGGERED"] || 1;
  const stageLabels = isFa ? STAGE_LABELS_FA : STAGE_LABELS_EN;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {isFa ? "تحلیل قیف تبدیل گفتگوها (Funnel Analytics)" : "Conversion Funnel Analytics"}
        </h1>
        <p className="text-sm text-muted mt-1">
          {isFa
            ? "گزارش دقیق مسیر حرکت مخاطبان از ورود تا ثبت نهایی شماره/ایمیل و رزرو سانس"
            : "Detailed tracking of user progression from keyword trigger to lead capture and final conversion."}
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label={isFa ? "نرخ تبدیل نهایی کل" : "Overall Conversion Rate"}
          value={`${data?.overallConversionRate ?? 0}%`}
        />
        <StatCard
          label={isFa ? "کل تعاملات شروع‌شده" : "Total Started Funnels"}
          value={data?.stageCounts["TRIGGERED"] ?? 0}
        />
        <StatCard
          label={isFa ? "مخاطبان تبدیل‌شده" : "Total Converted Users"}
          value={(data?.stageCounts["CONVERTED"] || 0) + (data?.stageCounts["COMPLETED"] || 0)}
        />
      </div>

      {/* Visual Funnel */}
      <section className="panel rounded p-6">
        <h2 className="text-base font-semibold text-foreground mb-6">
          {isFa ? "مراحل قیف گفتگو و ریزش مخاطبان" : "Funnel Stages & User Progression"}
        </h2>

        <div className="space-y-4">
          {Object.entries(stageLabels).map(([stageKey, label]) => {
            const count = data?.stageCounts[stageKey] || 0;
            const percentage = Math.round((count / Math.max(1, triggeredCount)) * 100);

            return (
              <div key={stageKey} className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-foreground">
                  <span>{label}</span>
                  <span className="font-mono text-accent" dir="ltr">
                    {count} {isFa ? "کاربر" : "users"} ({percentage}%)
                  </span>
                </div>

                <div className="w-full h-3 rounded-full bg-background overflow-hidden border border-border">
                  <div
                    className="h-full bg-accent transition-all duration-500 rounded-full"
                    style={{ width: `${Math.max(2, percentage)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
