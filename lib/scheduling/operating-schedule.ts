/**
 * OpenReply Smart Operating Schedule Engine
 * Backend-enforced operating hours, holidays, timezone calculation,
 * and out-of-hours response policy.
 */

import { prisma } from "@/lib/db/client";

export interface TimeInterval {
  start: string; // "HH:MM" e.g. "09:00"
  end: string;   // "HH:MM" e.g. "18:00"
}

export interface DaySchedule {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
  dayName?: string;
  enabled: boolean;
  intervals: TimeInterval[];
}

export interface OperatingScheduleConfig {
  isEnabled: boolean;
  timezone: string; // e.g. "Asia/Tehran"
  schedule: DaySchedule[];
  holidays: string[]; // "YYYY-MM-DD"
  outOfHoursAction: "SILENT" | "OUT_OF_OFFICE_MESSAGE" | "HUMAN_ESCALATION";
  outOfHoursMessage?: string | null;
}

export interface ScheduleEvaluationResult {
  isInside: boolean;
  reason?: string;
  action: "PROCEED" | "SILENT" | "SEND_OFFLINE_MESSAGE" | "ESCALATE";
  offlineMessage?: string;
  currentLocalTime?: string;
}

/**
 * Returns a default Iranian business operating schedule (Saturday to Wednesday 9-18, Thursday 9-14, Friday closed).
 */
export function getDefaultIranianSchedule(): DaySchedule[] {
  return [
    { dayOfWeek: 6, dayName: "شنبه", enabled: true, intervals: [{ start: "09:00", end: "18:00" }] },
    { dayOfWeek: 0, dayName: "یکشنبه", enabled: true, intervals: [{ start: "09:00", end: "18:00" }] },
    { dayOfWeek: 1, dayName: "دوشنبه", enabled: true, intervals: [{ start: "09:00", end: "18:00" }] },
    { dayOfWeek: 2, dayName: "سه‌شنبه", enabled: true, intervals: [{ start: "09:00", end: "18:00" }] },
    { dayOfWeek: 3, dayName: "چهارشنبه", enabled: true, intervals: [{ start: "09:00", end: "18:00" }] },
    { dayOfWeek: 4, dayName: "پنج‌شنبه", enabled: true, intervals: [{ start: "09:00", end: "14:00" }] },
    { dayOfWeek: 5, dayName: "جمعه", enabled: false, intervals: [] },
  ];
}

/**
 * Converts a time string "HH:MM" to minutes since midnight.
 */
function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Gets the current local date components for a target timezone.
 */
export function getZonedDateInfo(date: Date, timezone: string): {
  dayOfWeek: number;
  dateString: string; // "YYYY-MM-DD"
  minutesSinceMidnight: number;
  timeString: string; // "HH:MM"
} {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || "";

    const year = getPart("year");
    const month = getPart("month");
    const day = getPart("day");
    const hour = parseInt(getPart("hour"), 10) % 24;
    const minute = parseInt(getPart("minute"), 10);

    const weekdayStr = getPart("weekday");
    const weekdayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const dayOfWeek = weekdayMap[weekdayStr] ?? date.getDay();

    const dateString = `${year}-${month}-${day}`;
    const minutesSinceMidnight = hour * 60 + minute;
    const timeString = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

    return { dayOfWeek, dateString, minutesSinceMidnight, timeString };
  } catch {
    // Fallback to local machine timezone
    const hour = date.getHours();
    const minute = date.getMinutes();
    const dateString = date.toISOString().slice(0, 10);
    return {
      dayOfWeek: date.getDay(),
      dateString,
      minutesSinceMidnight: hour * 60 + minute,
      timeString: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    };
  }
}

/**
 * Checks whether an interval is active, including intervals spanning midnight (e.g. 22:00 to 02:00).
 */
export function isTimeInInterval(currentMinutes: number, startStr: string, endStr: string): boolean {
  const startMin = timeToMinutes(startStr);
  const endMin = timeToMinutes(endStr);

  if (startMin <= endMin) {
    // Standard daytime interval (e.g. 09:00 to 18:00)
    return currentMinutes >= startMin && currentMinutes < endMin;
  } else {
    // Midnight-spanning interval (e.g. 22:00 to 02:00)
    return currentMinutes >= startMin || currentMinutes < endMin;
  }
}

/**
 * Evaluates whether an incoming interaction is within active operating hours.
 */
export function isWithinOperatingHours(
  config: OperatingScheduleConfig,
  checkDate: Date = new Date()
): ScheduleEvaluationResult {
  // If schedule is disabled, operating hours are 24/7
  if (!config.isEnabled) {
    return { isInside: true, action: "PROCEED" };
  }

  const { dayOfWeek, dateString, minutesSinceMidnight, timeString } = getZonedDateInfo(
    checkDate,
    config.timezone || "Asia/Tehran"
  );

  // 1. Check holiday exception
  if (Array.isArray(config.holidays) && config.holidays.includes(dateString)) {
    return buildOutResult(config, `تاریخ ${dateString} جزو تعطیلات ثبت‌شده کسب‌وکار است.`);
  }

  // 2. Find schedule for current day of week
  const daySchedule = config.schedule.find((s) => s.dayOfWeek === dayOfWeek);

  if (!daySchedule || !daySchedule.enabled || daySchedule.intervals.length === 0) {
    return buildOutResult(config, `امروز در برنامه کاری فعال نیست.`);
  }

  // 3. Check each active interval
  const activeInterval = daySchedule.intervals.find((intv) =>
    isTimeInInterval(minutesSinceMidnight, intv.start, intv.end)
  );

  if (activeInterval) {
    return {
      isInside: true,
      action: "PROCEED",
      currentLocalTime: `${dateString} ${timeString}`,
    };
  }

  return buildOutResult(config, `ساعت فعلی (${timeString}) خارج از بازه کاری فعال است.`);
}

function buildOutResult(config: OperatingScheduleConfig, reason: string): ScheduleEvaluationResult {
  let action: "SILENT" | "SEND_OFFLINE_MESSAGE" | "ESCALATE" = "SILENT";

  if (config.outOfHoursAction === "OUT_OF_OFFICE_MESSAGE") {
    action = "SEND_OFFLINE_MESSAGE";
  } else if (config.outOfHoursAction === "HUMAN_ESCALATION") {
    action = "ESCALATE";
  }

  return {
    isInside: false,
    reason,
    action,
    offlineMessage:
      config.outOfHoursMessage ||
      "سلام! در حال حاضر خارج از ساعات کاری هستیم. پیام شما ثبت شد و در اولین فرصت در ساعات اداری با شما تماس خواهیم گرفت.",
  };
}

/**
 * Loads the active OperatingSchedule for an Instagram Account from DB.
 */
export async function getAccountOperatingSchedule(
  instagramAccountId: string
): Promise<OperatingScheduleConfig | null> {
  const schedule = await prisma.operatingSchedule.findUnique({
    where: { instagramAccountId },
  });

  if (!schedule) {
    return null;
  }

  return {
    isEnabled: schedule.isEnabled,
    timezone: schedule.timezone,
    schedule: Array.isArray(schedule.scheduleJson)
      ? (schedule.scheduleJson as unknown as DaySchedule[])
      : getDefaultIranianSchedule(),
    holidays: Array.isArray(schedule.holidaysJson)
      ? (schedule.holidaysJson as unknown as string[])
      : [],
    outOfHoursAction: schedule.outOfHoursAction as any,
    outOfHoursMessage: schedule.outOfHoursMessage,
  };
}
