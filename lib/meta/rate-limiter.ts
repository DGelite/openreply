/**
 * Meta Graph API v25.0 Rate-Limit & Danger-Zone Management
 */

export const APP_USAGE_WARN_THRESHOLD = 70;      // Start warning
export const APP_USAGE_DANGER_THRESHOLD = 85;    // Danger zone — back off aggressively
export const APP_USAGE_CRITICAL_THRESHOLD = 95;  // Critical — stop sending

let lastAppUsagePercent = 0;
let lastBusinessUsagePercent = 0;

export function getLastAppUsagePercent(): number {
  return lastAppUsagePercent;
}

export function getLastBusinessUsagePercent(): number {
  return lastBusinessUsagePercent;
}

export function updateUsagePercent(appUsage: number, businessUsage: number): void {
  lastAppUsagePercent = appUsage;
  lastBusinessUsagePercent = businessUsage;
}

export function isInDangerZone(): boolean {
  return (
    lastAppUsagePercent >= APP_USAGE_DANGER_THRESHOLD ||
    lastBusinessUsagePercent >= APP_USAGE_DANGER_THRESHOLD
  );
}

export function isAtCriticalLimit(): boolean {
  return (
    lastAppUsagePercent >= APP_USAGE_CRITICAL_THRESHOLD ||
    lastBusinessUsagePercent >= APP_USAGE_CRITICAL_THRESHOLD
  );
}

/**
 * Parse Meta's x-app-usage or x-business-use-case-usage header.
 * Both have the shape: { call_count: N, total_cputime: N, total_time: N }
 * where N is 0-100 percent.
 *
 * Returns the highest of the three values (most constrained metric).
 */
export function parseUsageHeader(header: string | null): number {
  if (!header) return 0;
  try {
    const parsed = JSON.parse(header);

    if (typeof parsed === "object" && parsed !== null) {
      const values = Object.values(parsed);
      if (Array.isArray(values[0])) {
        let max = 0;
        for (const accountData of values) {
          for (const entry of accountData as any[]) {
            const entryMax = Math.max(
              Number(entry.call_count ?? 0),
              Number(entry.total_cputime ?? 0),
              Number(entry.total_time ?? 0)
            );
            if (entryMax > max) max = entryMax;
          }
        }
        return max;
      }
      return Math.max(
        Number(parsed.call_count ?? 0),
        Number(parsed.total_cputime ?? 0),
        Number(parsed.total_time ?? 0)
      );
    }
  } catch {
    // Ignore parse errors
  }
  return 0;
}

/**
 * Calculate how long to wait before the next API call based on current usage %.
 * Returns 0 if well within limits, increasing delays as we approach danger zones.
 */
export function calculateUsageBackoffMs(usagePercent: number): number {
  if (usagePercent < APP_USAGE_WARN_THRESHOLD) return 0;
  if (usagePercent < APP_USAGE_DANGER_THRESHOLD) {
    return Math.floor((usagePercent - APP_USAGE_WARN_THRESHOLD) * 100);
  }
  if (usagePercent < APP_USAGE_CRITICAL_THRESHOLD) {
    return 5_000 + Math.floor((usagePercent - APP_USAGE_DANGER_THRESHOLD) * 500);
  }
  return 30_000;
}

/**
 * Apply a small backoff if we're near the Meta API usage ceiling.
 * This is called BEFORE every Meta send to respect the danger zone.
 * Returns the delay applied in ms (for logging), or 0 if not in danger zone.
 */
export async function applyDangerZoneBackoff(): Promise<number> {
  const maxUsage = Math.max(lastAppUsagePercent, lastBusinessUsagePercent);
  if (isAtCriticalLimit()) {
    const delay = 30_000;
    console.warn(
      `[MetaClient] CRITICAL rate limit danger zone: ${maxUsage}% usage. Backing off ${delay}ms before send.`
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
    return delay;
  }
  if (isInDangerZone()) {
    const delay = calculateUsageBackoffMs(maxUsage);
    if (delay > 0) {
      console.warn(
        `[MetaClient] High rate limit danger zone: ${maxUsage}% usage. Backing off ${delay}ms before send.`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return delay;
    }
  }
  return 0;
}
