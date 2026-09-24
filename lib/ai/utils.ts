import { AiConfig } from "@/lib/generated/prisma/client";

/**
 * Checks if the AI is currently active based on the user's configured active hours and timezone.
 * Returns true if activeHoursEnabled is false (always active) or if the current time falls within the range.
 */
export function isAiActive(config: AiConfig): boolean {
  if (!config.activeHoursEnabled) {
    return true; // Always active if scheduling is disabled
  }

  const { activeStartTime, activeEndTime, timezone } = config;

  if (!activeStartTime || !activeEndTime) {
    return true; // Fallback if times are not set
  }

  try {
    // Get current time in the specified timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "Asia/Tehran",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const currentHourStr = parts.find((p) => p.type === "hour")?.value || "00";
    const currentMinuteStr = parts.find((p) => p.type === "minute")?.value || "00";
    
    // Parse current time, start time, and end time to minutes since midnight
    const currentMinutes = parseInt(currentHourStr, 10) * 60 + parseInt(currentMinuteStr, 10);
    
    const [startHour, startMin] = activeStartTime.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;

    const [endHour, endMin] = activeEndTime.split(":").map(Number);
    const endMinutes = endHour * 60 + endMin;

    // Check if current time falls within the range
    if (startMinutes <= endMinutes) {
      // Normal range, e.g., 08:00 to 17:00
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else {
      // Overnight range, e.g., 17:00 to 08:00
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
  } catch (error) {
    console.error("Error evaluating AI active hours:", error);
    // If timezone is invalid or parsing fails, default to true to avoid breaking the bot
    return true; 
  }
}
