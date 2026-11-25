/**
 * Meta Graph API v25.0 & Instagram Messaging Compliance Guard
 * Centralizes enforcement for:
 *  1. 24-Hour Standard Messaging Window (no outbound DM without user interaction within 24h)
 *  2. 7-Day Private Reply Window for post/reel comments
 *  3. Meta Financial Policy (blocks raw 16-digit bank card numbers from automated DMs)
 *  4. Provider Policy/Rate-Limit error classification (Meta & BoxAPI)
 */

import { prisma } from "@/lib/db/client";
import {
  RateLimitError,
  PolicyBlockError,
  MessagingWindowExpiredError,
  CommentAlreadyRepliedError,
  UserUnreachableError,
  TokenExpiredError,
} from "./errors";
import { tripAccountCooldown } from "./circuit-breaker";

export const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Checks if a timestamp is within Meta's 24-hour standard messaging window.
 */
export function isWithin24HourWindow(
  lastInteractedAt?: Date | string | number | null,
  nowMs: number = Date.now()
): boolean {
  if (!lastInteractedAt) return false;
  const ts =
    lastInteractedAt instanceof Date
      ? lastInteractedAt.getTime()
      : typeof lastInteractedAt === "number"
      ? lastInteractedAt < 1e12
        ? lastInteractedAt * 1000
        : lastInteractedAt
      : Date.parse(lastInteractedAt);
  if (!Number.isFinite(ts) || ts <= 0) return false;
  return nowMs - ts <= TWENTY_FOUR_HOURS_MS;
}

/**
 * Checks if a comment creation timestamp is within Meta's 7-day private-reply window.
 * Returns true if timestamp is missing (so webhooks without created_at still proceed) or <= 7 days old.
 */
export function isCommentWithin7DayWindow(
  commentCreatedAt?: Date | string | number | null,
  nowMs: number = Date.now()
): boolean {
  if (!commentCreatedAt) return true;
  const ts =
    commentCreatedAt instanceof Date
      ? commentCreatedAt.getTime()
      : typeof commentCreatedAt === "number"
      ? commentCreatedAt < 1e12
        ? commentCreatedAt * 1000
        : commentCreatedAt
      : Date.parse(commentCreatedAt);
  if (!Number.isFinite(ts) || ts <= 0) return true;
  return nowMs - ts <= SEVEN_DAYS_MS;
}

/**
 * Queries ConversationState to verify whether the user has an open 24-hour DM window
 * and whether human handover is active.
 */
export async function hasOpen24HourWindow(
  instagramAccountId: string,
  userId: string
): Promise<{ open: boolean; isHumanHandover: boolean; lastInteractedAt: Date | null }> {
  const state = await prisma.conversationState.findUnique({
    where: {
      instagramAccountId_userId: { instagramAccountId, userId },
    },
    select: {
      lastInteractedAt: true,
      isHumanHandover: true,
    },
  });

  if (!state) {
    return { open: false, isHumanHandover: false, lastInteractedAt: null };
  }

  return {
    open: isWithin24HourWindow(state.lastInteractedAt),
    isHumanHandover: Boolean(state.isHumanHandover),
    lastInteractedAt: state.lastInteractedAt ?? null,
  };
}

/**
 * Luhn checksum validation to identify real 16-digit payment card numbers
 * and avoid false positives on random reference numbers.
 */
function passesLuhnCheck(digits16: string): boolean {
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits16.length - 1; i >= 0; i--) {
    let digit = Number(digits16[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

const CARD_CANDIDATE_REGEX = /(?:^|[^\d])([4569]\d{3}[-\s]?(?:\d{4}[-\s]?){2}\d{4})(?=$|[^\d])/g;

/**
 * Enforces Meta's financial data policy by redacting 16-digit payment card numbers
 * (e.g. Iranian bank cards 6037-/5022-/6219- or Visa/Mastercard) from automated DMs.
 * Never alters 11-digit mobile numbers or payment URLs.
 */
export function redactSensitiveFinancialData(text: string): {
  sanitized: string;
  redacted: boolean;
} {
  if (!text) return { sanitized: text, redacted: false };

  let redacted = false;
  // Normalize Persian/Arabic numerals temporarily on matched sequences only
  const normalizedForScan = text
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));

  const matchesToRedact: string[] = [];
  CARD_CANDIDATE_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CARD_CANDIDATE_REGEX.exec(normalizedForScan)) !== null) {
    const rawCandidate = match[1];
    const digitsOnly = rawCandidate.replace(/[-\s]/g, "");
    if (digitsOnly.length === 16 && passesLuhnCheck(digitsOnly)) {
      matchesToRedact.push(rawCandidate);
    }
  }

  if (matchesToRedact.length === 0) {
    return { sanitized: text, redacted: false };
  }

  let sanitized = normalizedForScan;
  for (const cardStr of matchesToRedact) {
    sanitized = sanitized.split(cardStr).join("[شماره کارت جهت رعایت قوانین اینستاگرام مخفی شد]");
    redacted = true;
  }

  // If no redaction happened, return untouched original text to preserve formatting/numerals
  return redacted ? { sanitized, redacted: true } : { sanitized: text, redacted: false };
}

/**
 * Classifies provider error messages (Meta or BoxAPI) and automatically trips
 * the account circuit breaker when policy/rate-limit signals occur.
 */
export function classifyProviderError(
  errorMessage?: string | null,
  instagramAccountId?: string
): Error | null {
  if (!errorMessage) return null;
  const lower = errorMessage.toLowerCase();

  if (
    lower.includes("2534015") ||
    lower.includes("already replied") ||
    lower.includes("private reply has already been sent")
  ) {
    return new CommentAlreadyRepliedError(errorMessage);
  }

  if (
    lower.includes("outside of allowed window") ||
    lower.includes("2018278") ||
    lower.includes("2534014") ||
    lower.includes("2018028") ||
    lower.includes("7 days") ||
    lower.includes("messaging window")
  ) {
    return new MessagingWindowExpiredError(2018278, errorMessage);
  }

  if (
    lower.includes("368") ||
    lower.includes("action blocked") ||
    lower.includes("temporarily blocked") ||
    lower.includes("policy block") ||
    lower.includes("spam") ||
    lower.includes("restricted")
  ) {
    if (instagramAccountId) {
      tripAccountCooldown(instagramAccountId, `PolicyBlock (${errorMessage.slice(0, 80)})`, 30 * 60 * 1000);
    }
    return new PolicyBlockError(errorMessage);
  }

  if (
    lower.includes("429") ||
    lower.includes("rate limit") ||
    lower.includes("too many calls") ||
    lower.includes("too many requests") ||
    lower.includes("80001")
  ) {
    if (instagramAccountId) {
      tripAccountCooldown(instagramAccountId, "RateLimit (Provider 429)", 5 * 60 * 1000);
    }
    return new RateLimitError(errorMessage, undefined, 5 * 60 * 1000);
  }

  if (
    lower.includes("code 190") ||
    lower.includes("token expired") ||
    lower.includes("invalid oauth")
  ) {
    if (instagramAccountId) {
      tripAccountCooldown(instagramAccountId, "TokenExpired (Code 190)", 60 * 60 * 1000);
    }
    return new TokenExpiredError(errorMessage);
  }

  if (
    lower.includes("cannot be dm") ||
    lower.includes("user is unreachable") ||
    lower.includes("2018001") ||
    lower.includes("551")
  ) {
    return new UserUnreachableError(errorMessage);
  }

  return null;
}
