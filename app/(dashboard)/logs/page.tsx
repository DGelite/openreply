"use client";

import { useEffect, useState, useCallback } from "react";
import AccountSelect, { type AccountOption } from "@/components/account-select";
import StatusBadge from "@/components/status-badge";
import { useLanguage } from "@/context/language-context";

interface DmLog {
  id: string;
  commenterId: string;
  commenterName: string | null;
  commentText: string;
  status: string;
  matchedKeyword?: string | null;
  errorMessage: string | null;
  createdAt: string;
  automation: { name: string; keywords: string[] };
  instagramAccount: { username: string };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STATUS_FILTERS = [
  { key: "ALL", labelFa: "همه لاگ‌ها", labelEn: "All" },
  { key: "SENT", labelFa: "ارسال‌شده (Sent)", labelEn: "Sent" },
  { key: "FAILED", labelFa: "شکست‌خورده (Failed)", labelEn: "Failed" },
  { key: "PENDING", labelFa: "در انتظار ارسال (Pending)", labelEn: "Pending" },
  { key: "SKIPPED_RATE_LIMIT", labelFa: "محدودیت اینستاگرام", labelEn: "Rate Limit" },
  { key: "SKIPPED_PLAN_LIMIT", labelFa: "محدودیت پلن", labelEn: "Plan Limit" },
  { key: "SKIPPED_DEDUP", labelFa: "پیام تکراری", labelEn: "Dedup" },
];

export default function LogsPage() {
  const { language } = useLanguage();
  const isFa = language === "fa";

  const [logs, setLogs] = useState<DmLog[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (selectedAccountId !== "all") {
        params.set("instagramAccountId", selectedAccountId);
      }
      if (searchQuery.trim()) {
        params.set("query", searchQuery.trim());
      }

      const res = await fetch(`/api/logs?${params}`, { cache: "no-store" });
      const data = await res.json();
      if (data.success && data.data) {
        setLogs(data.data.logs || []);
        setPagination(data.data.pagination || null);
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, selectedAccountId, searchQuery]);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((res) => res.json())
      .then((payload) => {
        if (payload.success) setAccounts(payload.data.instagramAccounts ?? []);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchLogs();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchLogs]);

  function handleFilterChange(status: string) {
    setStatusFilter(status);
    setPage(1);
  }

  function handleAccountChange(accountId: string) {
    setSelectedAccountId(accountId);
    setPage(1);
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <span>📋</span>
            <span>{isFa ? "گزارشات و لاگ‌های ارسال دایرکت" : "Automation DM Logs"}</span>
          </h1>
          <p className="text-xs text-muted mt-1">
            {isFa
              ? "مشاهده وضعیت پاسخ‌دهی به کامنت‌ها، پیام‌های ارسال‌شده، خطاهای اینستاگرام و نرخ ارسال"
              : "Track live status of comment triggers, sent messages, rate limit skips, and errors."}
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchLogs()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-xs font-medium text-muted hover:text-foreground hover:border-border-hover transition-colors shrink-0"
        >
          <span>🔄</span>
          <span>{isFa ? "بروزرسانی لاگ‌ها" : "Refresh Logs"}</span>
        </button>
      </div>

      {/* Filters & Search Bar */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="flex-1 max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder={isFa ? "جستجو بر اساس نام کاربر، متن کامنت یا کلمه کلیدی..." : "Search user, comment, or keyword..."}
              className="w-full rounded-lg border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent"
            />
          </div>

          {accounts.length > 1 && (
            <AccountSelect
              accounts={accounts}
              value={selectedAccountId}
              onChange={handleAccountChange}
            />
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1">
          {STATUS_FILTERS.map((item) => (
            <button
              key={item.key}
              onClick={() => handleFilterChange(item.key)}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0
                ${
                  statusFilter === item.key
                    ? "bg-accent/15 text-accent border border-accent/30 font-semibold"
                    : "bg-panel text-muted border border-border/80 hover:border-border hover:text-foreground"
                }
              `}
            >
              {isFa ? item.labelFa : item.labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* Table Section */}
      <div className="panel rounded-xl overflow-hidden border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right dir-rtl">
            <thead>
              <tr className="border-b border-border bg-surface/50 text-muted">
                <th className="px-5 py-3 font-semibold text-right">{isFa ? "مخاطب" : "User"}</th>
                <th className="px-5 py-3 font-semibold text-right">{isFa ? "متن کامنت / پیام" : "Comment / Msg"}</th>
                <th className="px-5 py-3 font-semibold text-right">{isFa ? "نام کمپین / فلو" : "Campaign"}</th>
                <th className="px-5 py-3 font-semibold text-right">{isFa ? "پیج اینستاگرام" : "Account"}</th>
                <th className="px-5 py-3 font-semibold text-center">{isFa ? "وضعیت ارسال" : "Status"}</th>
                <th className="px-5 py-3 font-semibold text-right">{isFa ? "زمان ثبت" : "Time"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading && (
                <>
                  {[...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="px-5 py-4">
                        <div className="h-4 bg-zinc-800/60 rounded animate-pulse" />
                      </td>
                    </tr>
                  ))}
                </>
              )}

              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-muted">
                    <div className="max-w-xs mx-auto space-y-2">
                      <span className="text-3xl block">📭</span>
                      <p className="font-semibold text-foreground text-sm">
                        {isFa ? "هیچ لاگی یافت نشد" : "No logs found"}
                      </p>
                      <p className="text-xs text-muted leading-relaxed">
                        {isFa
                          ? "هنوز پیامی ارسال نشده یا لاگی مطابق فیلترهای انتخابی شما ثبت نشده است."
                          : "No DM automation logs recorded matching your selected filters."}
                      </p>
                    </div>
                  </td>
                </tr>
              )}

              {!loading &&
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-surface/40 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-foreground font-medium">
                      @{log.commenterName ?? log.commenterId.slice(0, 8)}
                    </td>
                    <td className="px-5 py-3.5 max-w-[220px]">
                      <span className="text-foreground truncate block font-sans" title={log.commentText}>
                        {log.commentText || "—"}
                      </span>
                      {log.matchedKeyword && (
                        <span className="text-[10px] text-accent font-mono block mt-0.5">
                          کلمه کلیدی: {log.matchedKeyword}
                        </span>
                      )}
                      {log.errorMessage && (
                        <span className="text-[10px] text-rose-400 block mt-0.5 line-clamp-1" title={log.errorMessage}>
                          خطا: {log.errorMessage}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-muted">
                      {log.automation?.name || "فلو مستقیم"}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-muted">
                      @{log.instagramAccount?.username || "پیج اصلی"}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="px-5 py-3.5 text-muted whitespace-nowrap dir-ltr text-right font-mono">
                      {new Date(log.createdAt).toLocaleString(isFa ? "fa-IR" : "en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-border bg-surface/30">
            <p className="text-xs text-muted font-mono">
              نمایش {(pagination.page - 1) * pagination.limit + 1} تا{" "}
              {Math.min(pagination.page * pagination.limit, pagination.total)} از{" "}
              {pagination.total} رکورد
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted border border-border hover:text-foreground hover:border-border-hover transition-all disabled:opacity-30 disabled:pointer-events-none"
              >
                قبلی
              </button>
              <span className="text-xs text-muted font-mono px-2">
                {page} / {pagination.totalPages}
              </span>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted border border-border hover:text-foreground hover:border-border-hover transition-all disabled:opacity-30 disabled:pointer-events-none"
              >
                بعدی
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
