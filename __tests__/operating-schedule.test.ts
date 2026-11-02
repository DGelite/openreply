import { describe, it, expect } from "vitest";
import {
  isTimeInInterval,
  isWithinOperatingHours,
  getDefaultIranianSchedule,
  getZonedDateInfo,
  type OperatingScheduleConfig,
} from "@/lib/scheduling/operating-schedule";

describe("Operating Schedule Engine", () => {
  describe("Interval Checking (Standard & Midnight-crossing)", () => {
    it("handles daytime interval (09:00 to 18:00)", () => {
      // 09:30 is 570 mins
      expect(isTimeInInterval(570, "09:00", "18:00")).toBe(true);
      // 18:05 is 1085 mins (outside)
      expect(isTimeInInterval(1085, "09:00", "18:00")).toBe(false);
      // 08:59 is 539 mins (outside)
      expect(isTimeInInterval(539, "09:00", "18:00")).toBe(false);
    });

    it("handles midnight-spanning interval (22:00 to 02:00)", () => {
      // 23:30 is 1410 mins (inside)
      expect(isTimeInInterval(1410, "22:00", "02:00")).toBe(true);
      // 01:15 is 75 mins (inside)
      expect(isTimeInInterval(75, "22:00", "02:00")).toBe(true);
      // 03:00 is 180 mins (outside)
      expect(isTimeInInterval(180, "22:00", "02:00")).toBe(false);
      // 12:00 is 720 mins (outside)
      expect(isTimeInInterval(720, "22:00", "02:00")).toBe(false);
    });
  });

  describe("Schedule Evaluation & Out-of-Hours Actions", () => {
    const baseConfig: OperatingScheduleConfig = {
      isEnabled: true,
      timezone: "Asia/Tehran",
      schedule: [
        {
          dayOfWeek: 6, // Saturday
          enabled: true,
          intervals: [{ start: "09:00", end: "18:00" }],
        },
        {
          dayOfWeek: 5, // Friday
          enabled: false,
          intervals: [],
        },
      ],
      holidays: ["2026-03-21"],
      outOfHoursAction: "OUT_OF_OFFICE_MESSAGE",
      outOfHoursMessage: "پشتیبانان در حال استراحت هستند.",
    };

    it("allows execution when schedule is disabled (24/7 mode)", () => {
      const disabledConfig: OperatingScheduleConfig = {
        ...baseConfig,
        isEnabled: false,
      };
      const result = isWithinOperatingHours(disabledConfig, new Date());
      expect(result.isInside).toBe(true);
      expect(result.action).toBe("PROCEED");
    });

    it("blocks execution on scheduled holidays", () => {
      // Date in holiday: 2026-03-21 11:00 UTC
      const holidayDate = new Date("2026-03-21T11:00:00Z");
      const result = isWithinOperatingHours(baseConfig, holidayDate);
      expect(result.isInside).toBe(false);
      expect(result.action).toBe("SEND_OFFLINE_MESSAGE");
      expect(result.offlineMessage).toBe("پشتیبانان در حال استراحت هستند.");
    });

    it("respects SILENT action outside working hours", () => {
      const silentConfig: OperatingScheduleConfig = {
        ...baseConfig,
        outOfHoursAction: "SILENT",
      };
      // Friday (day 5 - disabled): 2026-03-20 is Friday
      const fridayDate = new Date("2026-03-20T10:00:00Z");
      const result = isWithinOperatingHours(silentConfig, fridayDate);
      expect(result.isInside).toBe(false);
      expect(result.action).toBe("SILENT");
    });

    it("respects HUMAN_ESCALATION action outside working hours", () => {
      const escalateConfig: OperatingScheduleConfig = {
        ...baseConfig,
        outOfHoursAction: "HUMAN_ESCALATION",
      };
      const fridayDate = new Date("2026-03-20T10:00:00Z");
      const result = isWithinOperatingHours(escalateConfig, fridayDate);
      expect(result.isInside).toBe(false);
      expect(result.action).toBe("ESCALATE");
    });
  });

  describe("Timezone Date Resolution", () => {
    it("correctly resolves Asia/Tehran local components", () => {
      const utcDate = new Date("2026-06-15T08:30:00Z");
      const info = getZonedDateInfo(utcDate, "Asia/Tehran");

      expect(info.dateString).toBe("2026-06-15");
      expect(info.timeString).toBeDefined();
      expect(info.minutesSinceMidnight).toBeGreaterThan(0);
    });

    it("provides default Iranian schedule (Saturday to Thursday)", () => {
      const defaultSched = getDefaultIranianSchedule();
      expect(defaultSched.length).toBe(7);

      const friday = defaultSched.find((s) => s.dayOfWeek === 5);
      expect(friday?.enabled).toBe(false);

      const saturday = defaultSched.find((s) => s.dayOfWeek === 6);
      expect(saturday?.enabled).toBe(true);
      expect(saturday?.intervals[0].start).toBe("09:00");
    });
  });
});
