"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface FlowItem {
  id: string;
  name: string;
  triggerType: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  dmMessage: string;
  flowGraph?: any;
}

const TRIGGER_LABELS: Record<string, { fa: string; color: string }> = {
  COMMENT:          { fa: "کامنت روی پست", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  COMMENT_KEYWORD:  { fa: "کامنت کلیدی",   color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  DIRECT_MESSAGE:   { fa: "پیام دایرکت",   color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  STORY_REPLY:      { fa: "ریپلای استوری", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  STORY_MENTION:    { fa: "منشن استوری",   color: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
  FAQ:              { fa: "سوالات متداول", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
  GIVEAWAY:         { fa: "قرعه‌کشی",      color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  LEAD_MAGNET:      { fa: "لید مگنت",      color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
  COUPON:           { fa: "کوپن تخفیف",    color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
};

function getTriggerInfo(type: string) {
  return TRIGGER_LABELS[type] || { fa: type, color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" };
}

function formatDate(isoStr: string) {
  return new Date(isoStr).toLocaleDateString("fa-IR", { year: "numeric", month: "short", day: "numeric" });
}

export default function FlowsPage() {
  const [flows, setFlows] = useState<FlowItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFlows();
  }, []);

  const fetchFlows = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/flows");
      if (res.ok) {
        const data = await res.json();
        setFlows(data.flows || []);
      }
    } catch (err) {
      console.error("Failed to load flows:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/flows/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      if (res.ok) {
        setFlows((prev) =>
          prev.map((f) => (f.id === id ? { ...f, isActive: !currentStatus } : f))
        );
      }
    } catch (err) {
      console.error("Failed to toggle flow:", err);
    }
  };

  const deleteFlow = async (id: string) => {
    if (!confirm("آیا از حذف این فلو اطمینان دارید؟")) return;
    try {
      const res = await fetch(`/api/flows/${id}`, { method: "DELETE" });
      if (res.ok) {
        setFlows((prev) => prev.filter((f) => f.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete flow:", err);
    }
  };

  const totalActive = flows.filter((f) => f.isActive).length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">فلوهای دیداری (Visual Flows)</h1>
          <p className="text-xs text-muted mt-0.5">
            طراحی و مدیریت فلوهای هوشمند دیداری به سبک ManyChat —{" "}
            {totalActive} فلوی فعال از {flows.length} کل
          </p>
        </div>
        <Link
          href="/flows/new"
          className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent/90 transition-colors"
        >
          + ساخت فلوی جدید
        </Link>
      </div>

      {loading ? (
        <div className="panel rounded-xl p-12 text-center text-xs text-muted">
          در حال بارگذاری فلوها...
        </div>
      ) : flows.length === 0 ? (
        <div className="panel rounded-xl p-12 text-center space-y-3">
          <p className="text-2xl">🔀</p>
          <p className="text-sm font-medium text-foreground">هنوز فلوی اتوماسیونی ساخته نشده است.</p>
          <p className="text-xs text-muted">با ساخت اولین فلو، فرآیند فروش و جمع‌آوری لید را خودکار کنید.</p>
          <Link
            href="/flows/new"
            className="inline-block rounded-lg bg-accent/10 border border-accent/30 px-4 py-2 text-xs font-semibold text-accent hover:bg-accent/20"
          >
            ساخت اولین فلوی دیداری
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {flows.map((flow) => {
            const trigger = getTriggerInfo(flow.triggerType);
            const nodeCount = flow.flowGraph?.nodes?.length ?? null;
            return (
              <div
                key={flow.id}
                className="panel rounded-xl p-5 space-y-3 border border-border hover:border-accent/40 transition-colors flex flex-col justify-between"
              >
                {/* Top row */}
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-medium ${trigger.color}`}>
                    {trigger.fa}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleActive(flow.id, flow.isActive)}
                    className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border transition-colors ${
                      flow.isActive
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                        : "bg-zinc-500/10 text-zinc-500 border-zinc-500/20 hover:bg-zinc-500/20"
                    }`}
                  >
                    {flow.isActive ? "● فعال" : "○ غیرفعال"}
                  </button>
                </div>

                {/* Name + preview */}
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground truncate">{flow.name}</h3>
                  <p className="text-xs text-muted line-clamp-2 leading-relaxed">
                    {flow.dmMessage || "بدون متن پیام"}
                  </p>
                </div>

                {/* Meta row */}
                <div className="flex items-center gap-3 text-[11px] text-muted">
                  {nodeCount !== null && (
                    <span className="flex items-center gap-1">
                      <span className="text-accent">◈</span> {nodeCount} نود
                    </span>
                  )}
                  <span>ویرایش: {formatDate(flow.updatedAt)}</span>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-border text-xs">
                  <Link
                    href={`/flows/${flow.id}/edit`}
                    className="font-medium text-accent hover:underline flex items-center gap-1"
                  >
                    ✏️ ویرایش فلو
                  </Link>
                  <button
                    type="button"
                    onClick={() => deleteFlow(flow.id)}
                    className="text-muted hover:text-rose-500 transition-colors"
                  >
                    حذف
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
