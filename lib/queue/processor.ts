import { prisma } from "@/lib/db/client";
import {
  RateLimitError,
  isAtCriticalLimit,
} from "@/lib/meta/client";
import { isAccountInCooldown } from "@/lib/meta/circuit-breaker";
import { safeDecryptToken } from "@/lib/meta/oauth";
import { matchKeywords } from "@/lib/utils/keyword-matcher";
import { reserveDMSlot } from "@/lib/utils/rate-limiter";
import {
  releaseWorkspaceDMReservation,
  reserveWorkspaceDMSend,
} from "@/lib/billing/usage";
import { ProcessCommentJob, ProcessPostbackJob, enqueueJob } from "./mysql-queue";
import {
  formatError,
  recordProcessorFailure,
  handleCommentProcessingError,
} from "./handlers/error-handler";
import { handlePublicCommentReply } from "./handlers/public-reply";
import { deliverPrivateReply, deliverPostbackReveal } from "./handlers/dm-delivery";

// Re-export error and alert helpers for complete backward compatibility
export { formatError, recordProcessorFailure };

export async function processComment(data: ProcessCommentJob, attemptsMade: number = 0): Promise<void> {
  const {
    instagramAccountId,
    commentId,
    commentText,
    commenterId,
    commenterName,
    mediaId,
  } = data;
  const requeueAttempt = data.requeueAttempt ?? 0;

  // ── Circuit Breaker check ──────────────────────────────────────────────────
  const cooldown = isAccountInCooldown(instagramAccountId);
  if (cooldown.inCooldown) {
    const delay = Math.max(30_000, cooldown.remainingMs);
    console.warn(`[Processor] Account ${instagramAccountId} in cooldown (${cooldown.reason}). Requeuing comment in ${Math.round(delay / 1000)}s.`);
    await enqueueJob("process-comment", { ...data, requeueAttempt: requeueAttempt + 1 }, delay);
    return;
  }

  // ── Danger zone check before ANY processing ───────────────────────────────
  // If we are critically rate-limited, skip this job and requeue it.
  // This prevents hammering Meta when we're at 95%+ usage.
  if (isAtCriticalLimit()) {
    console.warn(`[Processor] Critical Meta rate limit. Requeuing comment ${commentId} for 60 seconds.`);
    await enqueueJob("process-comment", { ...data, requeueAttempt: requeueAttempt + 1 }, 60_000);
    return;
  }

  const automations = await prisma.automation.findMany({
    where: {
      OR: [{ postId: mediaId }, { matchAnyPost: true }],
      isActive: true,
      instagramAccount: {
        instagramId: instagramAccountId,
      },
    },
    include: {
      instagramAccount: true,
      workspace: true,
      trackedLinks: {
        select: {
          slug: true,
          destinationUrl: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  for (const automation of automations) {
    const matchResult = automation.matchAnyWord
      ? { matched: true, matchedKeyword: null }
      : matchKeywords(
          commentText,
          automation.keywords as string[],
          automation.wholeWordMatch
        );

    if (!matchResult.matched) {
      continue;
    }

    const existingLog = await prisma.dmLog.findUnique({
      where: {
        automationId_commentId: {
          automationId: automation.id,
          commentId,
        },
      },
    });

    const alreadyDmd = existingLog?.status === "SENT";
    const alreadyPublicReplied = Boolean(existingLog?.publicReplySentAt);
    const needsDm = !alreadyDmd;

    if (existingLog?.status === "SKIPPED_PLAN_LIMIT") continue;
    if (alreadyDmd && (alreadyPublicReplied || !automation.publicReplyEnabled)) {
      continue;
    }

    if (!automation.instagramAccount.accessToken) {
      await prisma.dmLog.upsert({
        where: {
          automationId_commentId: {
            automationId: automation.id,
            commentId,
          },
        },
        create: {
          workspaceId: automation.workspaceId,
          automationId: automation.id,
          instagramAccountId: automation.instagramAccountId,
          commenterId,
          commenterName,
          commentText,
          commentId,
          matchedKeyword: matchResult.matchedKeyword,
          status: "FAILED",
          errorMessage: "No Instagram access token available",
        },
        update: {
          status: "FAILED",
          errorMessage: "No Instagram access token available",
        },
      });
      continue;
    }

    let accessToken: string;
    try {
      accessToken = safeDecryptToken(automation.instagramAccount.accessToken);
    } catch {
      await prisma.dmLog.upsert({
        where: {
          automationId_commentId: {
            automationId: automation.id,
            commentId,
          },
        },
        create: {
          workspaceId: automation.workspaceId,
          automationId: automation.id,
          instagramAccountId: automation.instagramAccountId,
          commenterId,
          commenterName,
          commentText,
          commentId,
          matchedKeyword: matchResult.matchedKeyword,
          status: "FAILED",
          errorMessage: "Failed to decrypt Instagram access token",
        },
        update: {
          status: "FAILED",
          errorMessage: "Failed to decrypt Instagram access token",
        },
      });
      continue;
    }

    if (!existingLog) {
      await prisma.dmLog.create({
        data: {
          workspaceId: automation.workspaceId,
          automationId: automation.id,
          instagramAccountId: automation.instagramAccountId,
          commenterId,
          commenterName,
          commentText,
          commentId,
          matchedKeyword: matchResult.matchedKeyword,
          status: "PENDING",
          attempts: attemptsMade + 1,
        },
      });
    } else if (needsDm) {
      await prisma.dmLog.update({
        where: {
          automationId_commentId: { automationId: automation.id, commentId },
        },
        data: {
          status: "PENDING",
          attempts: attemptsMade + 1,
          matchedKeyword: matchResult.matchedKeyword,
          errorMessage: null,
        },
      });
    }

    // ── Public comment reply ─────────────────────────────────────────────
    await handlePublicCommentReply({
      automation,
      accessToken,
      commentId,
      commenterName: commenterName ?? null,
      existingLog,
    });

    if (!needsDm) continue;

    const usage = await reserveWorkspaceDMSend(automation.workspaceId);
    if (!usage.allowed) {
      await prisma.dmLog.update({
        where: {
          automationId_commentId: {
            automationId: automation.id,
            commentId,
          },
        },
        data: {
          status: "SKIPPED_PLAN_LIMIT",
          matchedKeyword: matchResult.matchedKeyword,
          errorMessage: `Monthly DM limit reached (${usage.limit})`,
        },
      });
      continue;
    }

    let rateLimit;
    try {
      rateLimit = await reserveDMSlot(instagramAccountId, "COMMENT_REPLY", requeueAttempt);
    } catch (error) {
      await releaseWorkspaceDMReservation(
        automation.workspaceId,
        usage.periodStart
      );
      await prisma.dmLog.update({
        where: {
          automationId_commentId: {
            automationId: automation.id,
            commentId,
          },
        },
        data: {
          status: "FAILED",
          attempts: attemptsMade + 1,
          errorMessage: formatError(error),
        },
      });
      throw error;
    }

    if (!rateLimit.allowed) {
      await releaseWorkspaceDMReservation(
        automation.workspaceId,
        usage.periodStart
      );

      if (rateLimit.shouldSkip) {
        await prisma.dmLog.update({
          where: {
            automationId_commentId: {
              automationId: automation.id,
              commentId,
            },
          },
          data: {
            status: "SKIPPED_RATE_LIMIT",
            matchedKeyword: matchResult.matchedKeyword,
            errorMessage: "Hourly Instagram DM rate limit reached",
          },
        });
        continue;
      }

      if (rateLimit.shouldRequeue) {
        await prisma.dmLog.update({
          where: {
            automationId_commentId: {
              automationId: automation.id,
              commentId,
            },
          },
          data: {
            status: "PENDING",
            matchedKeyword: matchResult.matchedKeyword,
            errorMessage: "Hourly rate limit hit; retry scheduled",
          },
        });

        await enqueueJob(
          "process-comment",
          {
            ...data,
            requeueAttempt: requeueAttempt + 1,
          },
          rateLimit.requeueDelayMs
        );
        continue;
      }
    }

    try {
      await deliverPrivateReply({
        automation,
        accessToken,
        commentId,
        commenterId,
        commenterName: commenterName ?? null,
        commentText,
      });
    } catch (error) {
      await handleCommentProcessingError({
        error,
        instagramAccountId,
        automationId: automation.id,
        workspaceId: automation.workspaceId,
        commentId,
        commenterId,
        attemptsMade,
        requeueAttempt,
        data,
        periodStart: usage.periodStart,
      });
    }
  }
}

export async function processPostback(data: ProcessPostbackJob, attemptsMade: number = 0): Promise<void> {
  const { instagramAccountId, userId, payload, requeueAttempt = 0 } = data;
  const effectiveAttempts = Math.max(attemptsMade, requeueAttempt);

  if (!payload.startsWith("reveal:")) return;
  const automationId = payload.slice("reveal:".length);

  const automation = await prisma.automation.findFirst({
    where: { id: automationId, isActive: true },
    include: {
      instagramAccount: true,
      workspace: true,
      trackedLinks: {
        select: { slug: true, destinationUrl: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (
    !automation ||
    automation.instagramAccount.instagramId !== instagramAccountId ||
    !automation.instagramAccount.accessToken
  ) {
    return;
  }

  const dedupeId = `reveal:${userId}`;

  const openingLog = await prisma.dmLog.findFirst({
    where: { automationId: automation.id, commenterId: userId },
    select: { commenterName: true },
  });
  const commenterName = openingLog?.commenterName ?? null;
  const existingLog = await prisma.dmLog.findUnique({
    where: {
      automationId_commentId: { automationId: automation.id, commentId: dedupeId },
    },
    select: { status: true },
  });

  if (existingLog?.status === "SENT") {
    return;
  }

  let accessToken: string;
  try {
    accessToken = safeDecryptToken(automation.instagramAccount.accessToken);
  } catch {
    return;
  }

  let rateLimit;
  try {
    rateLimit = await reserveDMSlot(automation.instagramAccount.instagramId, "DIRECT_MESSAGE", effectiveAttempts);
  } catch (error) {
    throw error;
  }

  if (rateLimit.shouldSkip) {
    await prisma.dmLog.upsert({
      where: {
        automationId_commentId: { automationId: automation.id, commentId: dedupeId },
      },
      create: {
        workspaceId: automation.workspaceId,
        automationId: automation.id,
        instagramAccountId: automation.instagramAccountId,
        commenterId: userId,
        commenterName,
        commentText: "(button tap)",
        commentId: dedupeId,
        type: "DIRECT_MESSAGE",
        status: "SKIPPED_RATE_LIMIT",
        errorMessage: `Max retries exceeded for rate limit`,
      },
      update: { status: "SKIPPED_RATE_LIMIT" },
    });
    return;
  }

  if (rateLimit.shouldRequeue) {
    console.warn(`[Processor] Local rate limit reached for ${automation.instagramAccountId}. Requeuing postback.`);
    await enqueueJob("process-postback", { ...data, requeueAttempt: effectiveAttempts + 1 }, rateLimit.requeueDelayMs);
    return;
  }

  const usage = await reserveWorkspaceDMSend(automation.workspaceId);
  if (!usage.allowed) {
    await prisma.dmLog.upsert({
      where: {
        automationId_commentId: { automationId: automation.id, commentId: dedupeId },
      },
      create: {
        workspaceId: automation.workspaceId,
        automationId: automation.id,
        instagramAccountId: automation.instagramAccountId,
        commenterId: userId,
        commenterName,
        commentText: "(button tap)",
        commentId: dedupeId,
        type: "DIRECT_MESSAGE",
        status: "SKIPPED_PLAN_LIMIT",
        errorMessage: `Monthly DM limit reached (${usage.limit})`,
      },
      update: { status: "SKIPPED_PLAN_LIMIT" },
    });
    return;
  }

  try {
    await deliverPostbackReveal({
      automation,
      accessToken,
      userId,
      commenterName,
      dedupeId,
    });
  } catch (error) {
    await releaseWorkspaceDMReservation(automation.workspaceId, usage.periodStart);

    // Rate limit: requeue the reveal with appropriate backoff
    if (error instanceof RateLimitError) {
      console.warn(`[Processor] Rate limit on postback reveal for user ${userId}. Requeuing.`);
      await enqueueJob("process-postback", { ...data, requeueAttempt: effectiveAttempts + 1 }, error.retryAfterMs);
      return;
    }

    await prisma.dmLog.upsert({
      where: {
        automationId_commentId: { automationId: automation.id, commentId: dedupeId },
      },
      create: {
        workspaceId: automation.workspaceId,
        automationId: automation.id,
        instagramAccountId: automation.instagramAccountId,
        commenterId: userId,
        commenterName,
        commentText: "(button tap)",
        commentId: dedupeId,
        type: "DIRECT_MESSAGE",
        status: "FAILED",
        errorMessage: formatError(error),
      },
      update: { status: "FAILED", errorMessage: formatError(error) },
    });
    throw error;
  }
}
