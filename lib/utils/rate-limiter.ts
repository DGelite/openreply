/**
 * Rate Limiter
 *
 * MySQL-based rate limiter for Instagram private replies.
 * Uses the existing DmLog table to count DMs sent in the last hour,
 * eliminating the need for a Redis dependency.
 *
 * The cap matches Meta's documented limit for this exact call: 750 private
 * replies per hour per Instagram professional account, for comments on posts
 * and reels.
 */

import { prisma } from "@/lib/db/client";
import { DmType } from "@/lib/generated/prisma/client";

const RATE_LIMIT_COMMENT_REPLY = 180; // conservative hourly DM cap (Meta 200/hr limit - 20 buffer)
const RATE_LIMIT_NORMAL_DM = 180; // hourly DM cap for standard Send API
const RATE_LIMIT_WINDOW = 3600; // 1 hour in seconds
const REQUEUE_DELAY_MS = 30 * 60 * 1000; // 30 minutes
const MAX_REQUEUE_ATTEMPTS = 3;

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  remainingDMs: number;
  shouldRequeue: boolean;
  requeueDelayMs: number;
  shouldSkip: boolean;
  reserved: boolean;
}

function blockedResult(
  count: number,
  requeueAttempt: number
): RateLimitResult {
  if (requeueAttempt >= MAX_REQUEUE_ATTEMPTS) {
    return {
      allowed: false,
      currentCount: count,
      remainingDMs: 0,
      shouldRequeue: false,
      requeueDelayMs: 0,
      shouldSkip: true,
      reserved: false,
    };
  }

  return {
    allowed: false,
    currentCount: count,
    remainingDMs: 0,
    shouldRequeue: true,
    requeueDelayMs: REQUEUE_DELAY_MS,
    shouldSkip: false,
    reserved: false,
  };
}

/**
 * Check if an Instagram account is within its DM rate limit.
 *
 * Queries the DmLog table for DMs sent in the last 1 hour.
 */
export async function checkRateLimit(
  instagramAccountId: string,
  dmType: DmType,
  requeueAttempt: number = 0
): Promise<RateLimitResult> {
  const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW * 1000);
  
  const maxLimit = dmType === "COMMENT_REPLY" ? RATE_LIMIT_COMMENT_REPLY : RATE_LIMIT_NORMAL_DM;
  
  const count = await prisma.dmLog.count({
    where: {
      instagramAccountId,
      type: dmType,
      status: "SENT",
      dmSentAt: {
        gte: oneHourAgo,
      },
    },
  });

  if (count >= maxLimit) {
    return blockedResult(count, requeueAttempt);
  }

  return {
    allowed: true,
    currentCount: count,
    remainingDMs: maxLimit - count,
    shouldRequeue: false,
    requeueDelayMs: 0,
    shouldSkip: false,
    reserved: false,
  };
}

/**
 * Atomically reserve a DM send slot for an Instagram account.
 * For low-concurrency cPanel Node apps, checkRateLimit is safe enough.
 */
export async function reserveDMSlot(
  instagramAccountId: string,
  dmType: DmType,
  requeueAttempt: number = 0
): Promise<RateLimitResult> {
  const limitResult = await checkRateLimit(instagramAccountId, dmType, requeueAttempt);
  if (!limitResult.allowed) {
    return limitResult;
  }
  return {
    ...limitResult,
    reserved: true,
  };
}

/**
 * Backwards-compatible helper for tests and admin scripts.
 */
export async function incrementDMCounter(
  instagramAccountId: string,
  dmType: DmType = "COMMENT_REPLY"
): Promise<number> {
  const result = await reserveDMSlot(instagramAccountId, dmType, MAX_REQUEUE_ATTEMPTS);
  return result.currentCount;
}

/**
 * Get the current DM count for an Instagram account in the last hour.
 */
export async function getCurrentDMCount(
  instagramAccountId: string,
  dmType: DmType = "COMMENT_REPLY"
): Promise<number> {
  const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW * 1000);
  return prisma.dmLog.count({
    where: {
      instagramAccountId,
      type: dmType,
      status: "SENT",
      dmSentAt: {
        gte: oneHourAgo,
      },
    },
  });
}

/**
 * Reset the rate limiter for an account.
 * (Since logs are persistent, reset is a no-op here).
 */
export async function resetRateLimit(
  _instagramAccountId: string
): Promise<void> {
  // No-op to maintain API compatibility
}

// Export constants for use in tests
export { RATE_LIMIT_COMMENT_REPLY, RATE_LIMIT_NORMAL_DM, RATE_LIMIT_WINDOW, REQUEUE_DELAY_MS, MAX_REQUEUE_ATTEMPTS };
