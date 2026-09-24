"use client";

import React, { useEffect, useState } from "react";
import { useLanguage } from "@/context/language-context";

interface FeatureFlagItem {
  id: string;
  key: string;
  nameFa: string;
  nameEn: string;
  descFa: string;
  descEn: string;
  icon: string;
  isEnabled: boolean;
  config?: any;
}

export default function FeaturesAdminPage() {
  const { language } = useLanguage();
  const isFa = language === "fa";

  const [features, setFeatures] = useState<FeatureFlagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  useEffect(() => {
    fetchFeatures();
  }, []);

  const fetchFeatures = async () => {
    try {
      const res = await fetch("/api/admin/feature-flags");
      const data = await res.json();
      if (data.success && Array.isArray(data.flags)) {
        setFeatures(data.flags);
      } else if (Array.isArray(data.data)) {
        setFeatures(data.data);
      }
    } catch (err) {
      console.error("Failed to load feature flags", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFeature = async (featureKey: string, currentStatus: boolean) => {
    setTogglingKey(featureKey);
    // Optimistic UI update
    setFeatures((prev) =>
      prev.map((f) => (f.key === featureKey || f.id === featureKey ? { ...f, isEnabled: !currentStatus } : f))
    );

    try {
      const res = await fetch("/api/admin/feature-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: featureKey, isEnabled: !currentStatus }),
      });
      const data = await res.json();
      if (!data.success) {
        // Revert on error
        setFeatures((prev) =>
          prev.map((f) => (f.key === featureKey || f.id === featureKey ? { ...f, isEnabled: currentStatus } : f))
        );
      }
    } catch (err) {
      console.error("Failed to toggle feature flag", err);
      // Revert on error
      setFeatures((prev) =>
        prev.map((f) => (f.key === featureKey || f.id === featureKey ? { ...f, isEnabled: currentStatus } : f))
      );
    } finally {
      setTogglingKey(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-5xl mx-auto p-4">
        <div className="h-10 bg-surface/50 rounded-lg animate-pulse w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="panel rounded-xl p-5 h-32 animate-pulse bg-surface/50" />
          ))}
        </div>
      </div>
    );
  }

  const enabledCount = features.filter((f) => f.isEnabled).length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚙️</span>
            <h1 className="text-xl font-bold text-foreground">
              {isFa ? "مرکز کنترل ویژگی‌ها و قابلیت‌های پلتفرم" : "Feature Control Panel"}
            </h1>
          </div>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            {isFa
              ? "مدیریت یکپارچه زیرسیستم‌ها، موتور هوش مصنوعی، صَف پیام‌ها و رفتار ضداسپم پلتفرم"
              : "Toggle core platform capabilities, message queues, AI engine, and anti-spam services."}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 bg-panel px-3.5 py-1.5 rounded-full border border-border">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-mono text-foreground font-medium">
            {enabledCount} / {features.length} {isFa ? "قابلیت فعال" : "Active"}
          </span>
        </div>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {features.map((feature) => {
          const isToggling = togglingKey === feature.key;

          return (
            <div
              key={feature.key || feature.id}
              className={`panel rounded-xl p-5 border transition-all flex flex-col justify-between space-y-4 ${
                feature.isEnabled
                  ? "border-accent/40 bg-accent/[0.02]"
                  : "border-border/60 bg-panel/50 opacity-80 hover:opacity-100"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-surface border border-border/80 flex items-center justify-center text-xl shrink-0">
                    {feature.icon || "⚙️"}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-foreground">
                        {isFa ? feature.nameFa || feature.key : feature.nameEn || feature.key}
                      </h3>
                      <code className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border/60 font-mono text-accent">
                        {feature.key}
                      </code>
                    </div>
                    <p className="text-xs text-muted leading-relaxed">
                      {isFa ? feature.descFa : feature.descEn}
                    </p>
                  </div>
                </div>

                {/* Switch Toggle */}
                <button
                  type="button"
                  disabled={isToggling}
                  onClick={() => toggleFeature(feature.key, feature.isEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    feature.isEnabled ? "bg-accent" : "bg-zinc-700"
                  } ${isToggling ? "opacity-50 cursor-wait" : ""}`}
                  role="switch"
                  aria-checked={feature.isEnabled}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      feature.isEnabled ? (isFa ? "-translate-x-5" : "translate-x-5") : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Footer status */}
              <div className="flex items-center justify-between pt-3 border-t border-border/40 text-[11px] text-muted">
                <span className="flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      feature.isEnabled ? "bg-emerald-400" : "bg-zinc-500"
                    }`}
                  />
                  {feature.isEnabled ? (isFa ? "فعال در کل سیستم" : "Active System-wide") : (isFa ? "غیرفعال" : "Disabled")}
                </span>

                {feature.config && (
                  <span className="font-mono text-[10px] text-muted/80">
                    {Object.keys(feature.config).length} {isFa ? "پارامتر کانفیگ" : "configs"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
