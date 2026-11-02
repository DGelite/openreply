"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/context/language-context";

interface TimeInterval {
  start: string;
  end: string;
}

interface DaySchedule {
  dayOfWeek: number;
  dayName?: string;
  enabled: boolean;
  intervals: TimeInterval[];
}

export function OperatingScheduleCard({ accountId }: { accountId?: string }) {
  const { language } = useLanguage();
  const isFa = language === "fa";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [isEnabled, setIsEnabled] = useState(true);
  const [timezone, setTimezone] = useState("Asia/Tehran");
  const [outOfHoursAction, setOutOfHoursAction] = useState<"OUT_OF_OFFICE_MESSAGE" | "SILENT" | "HUMAN_ESCALATION">("OUT_OF_OFFICE_MESSAGE");
  const [outOfHoursMessage, setOutOfHoursMessage] = useState(
    "سلام! در حال حاضر خارج از ساعات کاری هستیم. پیام شما دریافت شد و در اولین فرصت در ساعات اداری پاسخ داده خواهد شد. 🙏"
  );
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [holidaysStr, setHolidaysStr] = useState("");

  const dayNamesFa: Record<number, string> = {
    6: "شنبه",
    0: "یکشنبه",
    1: "دوشنبه",
    2: "سه‌شنبه",
    3: "چهارشنبه",
    4: "پنج‌شنبه",
    5: "جمعه",
  };

  useEffect(() => {
    const url = accountId ? `/api/settings/schedule?accountId=${accountId}` : "/api/settings/schedule";
    fetch(url)
      .then((res) => res.json())
      .then((payload) => {
        if (payload.success && payload.data) {
          const d = payload.data;
          setIsEnabled(d.isEnabled ?? true);
          setTimezone(d.timezone || "Asia/Tehran");
          setOutOfHoursAction(d.outOfHoursAction || "OUT_OF_OFFICE_MESSAGE");
          if (d.outOfHoursMessage) setOutOfHoursMessage(d.outOfHoursMessage);
          if (Array.isArray(d.schedule)) {
            setSchedule(d.schedule);
          }
          if (Array.isArray(d.holidays)) {
            setHolidaysStr(d.holidays.join("، "));
          }
        }
      })
      .catch((err) => console.error("Failed to load schedule:", err))
      .finally(() => setLoading(false));
  }, [accountId]);

  const handleToggleDay = (dayIndex: number) => {
    setSchedule((prev) =>
      prev.map((day) =>
        day.dayOfWeek === dayIndex
          ? {
              ...day,
              enabled: !day.enabled,
              intervals: !day.enabled && day.intervals.length === 0
                ? [{ start: "09:00", end: "18:00" }]
                : day.intervals,
            }
          : day
      )
    );
  };

  const handleIntervalChange = (dayIndex: number, field: "start" | "end", value: string) => {
    setSchedule((prev) =>
      prev.map((day) => {
        if (day.dayOfWeek !== dayIndex) return day;
        const currentIntv = day.intervals[0] || { start: "09:00", end: "18:00" };
        return {
          ...day,
          intervals: [{ ...currentIntv, [field]: value }],
        };
      })
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const holidays = holidaysStr
      .split(/[،,]/)
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const res = await fetch("/api/settings/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          isEnabled,
          timezone,
          schedule,
          holidays,
          outOfHoursAction,
          outOfHoursMessage,
        }),
      });

      const payload = await res.json();
      if (payload.success) {
        setMessage({
          type: "success",
          text: isFa ? "✅ ساعات کاری با موفقیت ذخیره شد." : "Operating schedule saved successfully.",
        });
      } else {
        setMessage({
          type: "error",
          text: payload.error || (isFa ? "خطا در ذخیره ساعات کاری" : "Failed to save schedule"),
        });
      }
    } catch {
      setMessage({
        type: "error",
        text: isFa ? "خطای ارتباط با سرور" : "Network error saving schedule",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="panel rounded p-6 animate-pulse h-48 bg-surface/50" />;
  }

  return (
    <section className="panel rounded p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {isFa ? "ساعات کاری و پاسخگویی هوشمند (Operating Schedule)" : "Operating Schedule & Hours"}
          </h2>
          <p className="text-xs text-muted mt-1">
            {isFa
              ? "تعیین روزها و ساعات مجاز ارسال پاسخ خودکار، ایام تعطیل و نحوه مدیریت پیام‌های خارج از وقت اداری"
              : "Manage active business hours, holidays, and out-of-office automated behaviors."}
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => setIsEnabled(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent border border-border"></div>
        </label>
      </div>

      {message && (
        <div
          className={`p-3 rounded mb-4 text-xs font-medium ${
            message.type === "success"
              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
              : "bg-red-500/10 text-red-600 border border-red-500/20"
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              {isFa ? "منطقه زمانی (Timezone)" : "Timezone"}
            </label>
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent/40"
              placeholder="Asia/Tehran"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              {isFa ? "رفتار سیستم خارج از ساعات کاری" : "Out-of-Hours Policy"}
            </label>
            <select
              value={outOfHoursAction}
              onChange={(e) => setOutOfHoursAction(e.target.value as any)}
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent/40"
            >
              <option value="OUT_OF_OFFICE_MESSAGE">
                {isFa ? "ارسال پیام خودکار عدم حضور (Out of Office)" : "Send Out-of-Office Message"}
              </option>
              <option value="SILENT">
                {isFa ? "سکوت کامل (هیچ پیامی ارسال نشود)" : "Silent (No reply)"}
              </option>
              <option value="HUMAN_ESCALATION">
                {isFa ? "انتقال فوری به صف اپراتور انسانی" : "Escalate to Human Operator"}
              </option>
            </select>
          </div>
        </div>

        {outOfHoursAction !== "SILENT" && (
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              {isFa ? "متن پیام خارج از ساعات کاری" : "Out-of-Office Notice Message"}
            </label>
            <textarea
              rows={2}
              value={outOfHoursMessage}
              onChange={(e) => setOutOfHoursMessage(e.target.value)}
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent/40"
            />
          </div>
        )}

        {/* 7 Days Schedule Matrix */}
        <div className="pt-2">
          <label className="block text-xs font-semibold text-foreground mb-2">
            {isFa ? "برنامه کاری روزهای هفته" : "Weekly Schedule"}
          </label>
          <div className="space-y-2 border border-border rounded p-3 bg-surface/50">
            {[6, 0, 1, 2, 3, 4, 5].map((dayNum) => {
              const day = schedule.find((s) => s.dayOfWeek === dayNum) || {
                dayOfWeek: dayNum,
                enabled: dayNum !== 5,
                intervals: [{ start: "09:00", end: "18:00" }],
              };
              const interval = day.intervals[0] || { start: "09:00", end: "18:00" };

              return (
                <div
                  key={dayNum}
                  className="flex items-center justify-between gap-4 py-1.5 border-b border-border/50 last:border-0"
                >
                  <div className="flex items-center gap-3 w-28">
                    <input
                      type="checkbox"
                      id={`day-${dayNum}`}
                      checked={day.enabled}
                      onChange={() => handleToggleDay(dayNum)}
                      className="rounded border-border text-accent focus:ring-accent"
                    />
                    <label htmlFor={`day-${dayNum}`} className="text-xs font-medium text-foreground cursor-pointer">
                      {dayNamesFa[dayNum]}
                    </label>
                  </div>

                  {day.enabled ? (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted">{isFa ? "از" : "From"}</span>
                      <input
                        type="time"
                        value={interval.start}
                        onChange={(e) => handleIntervalChange(dayNum, "start", e.target.value)}
                        className="rounded border border-border bg-surface px-2 py-1 text-xs text-foreground outline-none"
                      />
                      <span className="text-muted">{isFa ? "تا" : "To"}</span>
                      <input
                        type="time"
                        value={interval.end}
                        onChange={(e) => handleIntervalChange(dayNum, "end", e.target.value)}
                        className="rounded border border-border bg-surface px-2 py-1 text-xs text-foreground outline-none"
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-muted/60 font-medium">
                      {isFa ? "تعطیل" : "Closed"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            {isFa ? "تاریخ‌های تعطیلات رسمی و خاص (YYYY-MM-DD با کاما جدا کنید)" : "Holidays / Excluded Dates"}
          </label>
          <input
            type="text"
            value={holidaysStr}
            onChange={(e) => setHolidaysStr(e.target.value)}
            placeholder="2026-03-21, 2026-03-22, 2026-04-01"
            className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent/40"
          />
        </div>

        <div className="pt-3 border-t border-border flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-accent px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {saving ? (isFa ? "در حال ذخیره..." : "Saving...") : (isFa ? "ذخیره تنظیمات ساعات کاری" : "Save Schedule")}
          </button>
        </div>
      </form>
    </section>
  );
}
