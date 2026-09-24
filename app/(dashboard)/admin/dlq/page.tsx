"use client";

import React, { useEffect, useState } from "react";
import { useLanguage } from "@/context/language-context";

interface DLQItem {
  id: string;
  source: string;
  payload: any;
  errorMessage: string | null;
  status: string;
  attempts: number;
  createdAt: string;
}

export default function AdminDLQPage() {
  const { language } = useLanguage();
  const isFa = language === "fa";

  const [messages, setMessages] = useState<DLQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    fetchDLQ();
  }, []);

  async function fetchDLQ() {
    try {
      const res = await fetch("/api/admin/dlq");
      const data = await res.json();
      if (data.dlqMessages) {
        setMessages(data.dlqMessages);
      }
    } catch (err) {
      console.error("Failed to load DLQ messages:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(id: string, action: "RETRY" | "RESOLVE" | "IGNORE") {
    setActionId(id);
    try {
      const res = await fetch("/api/admin/dlq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== id));
      }
    } catch (err) {
      console.error("Failed to execute action:", err);
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {isFa ? "صف پیام‌های ناموفق (DLQ)" : "Dead Letter Queue (DLQ)"}
        </h1>
        <p className="text-sm text-muted mt-1">
          {isFa
            ? "بررسی خطاهای پردازش پیام‌ها و تلاش مجدد برای ارسال به مخاطبان"
            : "Monitor system execution failures, inspect payloads, and manually retry messages."}
        </p>
      </div>

      <section className="panel rounded p-6">
        {loading ? (
          <div className="h-32 animate-pulse bg-surface/50 rounded" />
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-muted">
            <p className="text-sm font-semibold text-success">
              {isFa ? "هیچ پیام خطاخورده‌ای وجود ندارد!" : "No failed messages in queue!"}
            </p>
            <p className="text-xs text-muted mt-1">
              {isFa ? "تمام پردازش‌ها و ارسال‌ها با موفقیت ۱۰۰٪ انجام شده‌اند." : "All background queues and webhooks are operating normally."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded border border-border bg-surface/70 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-error/10 text-error border border-error/20">
                      {item.source}
                    </span>
                    <span className="text-xs text-muted" dir="ltr">
                      {isFa ? `تلاش‌ها: ${item.attempts}` : `Attempts: ${item.attempts}`}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-error truncate">
                    {item.errorMessage || (isFa ? "خطای ناشناخته" : "Unknown Error")}
                  </p>
                  <pre className="text-[11px] font-mono text-muted max-h-24 overflow-y-auto p-3 rounded bg-background border border-border" dir="ltr">
                    {JSON.stringify(item.payload, null, 2)}
                  </pre>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    disabled={actionId === item.id}
                    onClick={() => handleAction(item.id, "RETRY")}
                    className="px-4 py-2 rounded bg-accent hover:bg-accent-hover text-white font-medium text-xs transition-colors disabled:opacity-50"
                  >
                    {isFa ? "تلاش مجدد" : "Retry"}
                  </button>
                  <button
                    disabled={actionId === item.id}
                    onClick={() => handleAction(item.id, "RESOLVE")}
                    className="px-4 py-2 rounded border border-border bg-surface hover:bg-surface-hover text-muted hover:text-foreground font-medium text-xs transition-colors disabled:opacity-50"
                  >
                    {isFa ? "علامت‌گذاری حل‌شده" : "Mark Resolved"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
