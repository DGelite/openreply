/**
 * Meta Account Circuit Breaker & Anti-Ban Cooldown Manager
 * 
 * Prevents account bans and API hammering by pausing outbound calls to Meta Graph API
 * when an Instagram account encounters rate limits (4, 17, 32, 613), temporary blocks (368),
 * or invalid tokens (190).
 */

interface CooldownEntry {
  accountId: string;
  reason: string;
  tripTime: number;
  cooldownUntil: number;
}

const DEFAULT_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes default
const POLICY_BLOCK_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes for code 368

const activeCooldowns = new Map<string, CooldownEntry>();

/**
 * Trips the circuit breaker for an Instagram Account.
 */
export function tripAccountCooldown(
  accountId: string,
  reason: string,
  cooldownMs?: number
): void {
  const duration = cooldownMs ?? (reason.includes("368") ? POLICY_BLOCK_COOLDOWN_MS : DEFAULT_COOLDOWN_MS);
  const now = Date.now();
  const entry: CooldownEntry = {
    accountId,
    reason,
    tripTime: now,
    cooldownUntil: now + duration,
  };

  activeCooldowns.set(accountId, entry);
  console.warn(
    `[Circuit Breaker] Tripped cooldown for account ${accountId}. Reason: "${reason}". Cooldown: ${Math.round(
      duration / 1000
    )}s`
  );
}

/**
 * Checks if an Instagram Account is currently under circuit breaker cooldown.
 */
export function isAccountInCooldown(accountId: string): {
  inCooldown: boolean;
  remainingMs: number;
  reason?: string;
} {
  const entry = activeCooldowns.get(accountId);
  if (!entry) {
    return { inCooldown: false, remainingMs: 0 };
  }

  const now = Date.now();
  if (now >= entry.cooldownUntil) {
    activeCooldowns.delete(accountId);
    console.info(`[Circuit Breaker] Cooldown expired for account ${accountId}. Resuming normal operations.`);
    return { inCooldown: false, remainingMs: 0 };
  }

  return {
    inCooldown: true,
    remainingMs: entry.cooldownUntil - now,
    reason: entry.reason,
  };
}

/**
 * Manually clears an account's cooldown (e.g. after token renewal or admin review).
 */
export function clearAccountCooldown(accountId: string): void {
  activeCooldowns.delete(accountId);
}

/**
 * Returns all currently active account cooldowns (useful for admin diagnostics).
 */
export function getAllActiveCooldowns(): CooldownEntry[] {
  const now = Date.now();
  const results: CooldownEntry[] = [];
  for (const [id, entry] of activeCooldowns.entries()) {
    if (now < entry.cooldownUntil) {
      results.push(entry);
    } else {
      activeCooldowns.delete(id);
    }
  }
  return results;
}
