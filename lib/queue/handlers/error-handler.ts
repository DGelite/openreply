import { prisma } from "@/lib/db/client";
import {
  MetaApiError,
  RateLimitError,
  PolicyBlockError,
  CommentAlreadyRepliedError,
  MessagingWindowExpiredError,
  UserUnreachableError,
  TokenExpiredError,
} from "@/lib/meta/client";
import { tripAccountCooldown } from "@/lib/meta/circuit-breaker";
import { releaseWorkspaceDMReservation } from "@/lib/billing/usage";
import { recordWorkerAlert } from "@/lib/ops/worker-health";
import { ProcessCommentJob, enqueueJob } from "../mysql-queue";

export function formatError(error: unknown): string {
  if (error instanceof MetaApiError) {
    return `Meta API Error ${error.code}: ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}

export async function recordProcessorFailure(
  name: string,
  data: any,
  attemptsMade: number,
  error: Error
) {
  try {
    const instagramAccountId = data?.instagramAccountId;
    const commentId = data?.commentId ?? null;
    const account = instagramAccountId
      ? await prisma.instagramAccount.findUnique({
          where: { instagramId: instagramAccountId },
          select: { workspaceId: true },
        })
      : null;

    await prisma.operationalEvent.create({
      data: {
        workspaceId: account?.workspaceId ?? null,
        source: "WORKER",
        level: "ERROR",
        message: `DM processor job failed: ${error.message}`,
        payload: {
          jobName: name,
          attemptsMade,
          instagramAccountId: instagramAccountId ?? null,
          commentId,
        },
      },
    });

    await recordWorkerAlert({
      level: "error",
      message: error.message,
      instagramAccountId,
      commentId: commentId ?? undefined,
    });
  } catch (recordError) {
    console.error(
      "[DM Processor] Failed to record failure:",
      formatError(recordError)
    );
  }
}

export async function handleCommentProcessingError(params: {
  error: unknown;
  instagramAccountId: string;
  automationId: string;
  workspaceId: string;
  commentId: string;
  commenterId: string;
  attemptsMade: number;
  requeueAttempt: number;
  data: ProcessCommentJob;
  periodStart?: Date | null;
}): Promise<void> {
  const {
    error,
    instagramAccountId,
    automationId,
    workspaceId,
    commentId,
    commenterId,
    attemptsMade,
    requeueAttempt,
    data,
    periodStart,
  } = params;

  if (periodStart) {
    await releaseWorkspaceDMReservation(workspaceId, periodStart);
  }

  if (error instanceof PolicyBlockError) {
    tripAccountCooldown(instagramAccountId, "PolicyBlock (Code 368)", 30 * 60 * 1000);
    await prisma.dmLog.update({
      where: {
        automationId_commentId: { automationId, commentId },
      },
      data: {
        status: "PENDING",
        attempts: attemptsMade + 1,
        errorMessage: "Temporary Meta policy cooldown active — retry scheduled in 30m",
      },
    });
    await enqueueJob("process-comment", { ...data, requeueAttempt: requeueAttempt + 1 }, 30 * 60 * 1000);
    return;
  }

  if (error instanceof CommentAlreadyRepliedError) {
    console.info(`[Processor] Comment ${commentId} already replied to via private reply.`);
    await prisma.dmLog.update({
      where: {
        automationId_commentId: { automationId, commentId },
      },
      data: {
        status: "SENT",
        errorMessage: "Already replied to comment (Meta Subcode 2534015)",
      },
    });
    return;
  }

  if (error instanceof MessagingWindowExpiredError) {
    console.warn(`[Processor] 7-day comment window or messaging window expired for comment ${commentId}.`);
    await prisma.dmLog.update({
      where: {
        automationId_commentId: { automationId, commentId },
      },
      data: {
        status: "FAILED",
        errorMessage: "7-day comment window or messaging window expired (Meta policy)",
      },
    });
    return;
  }

  if (error instanceof UserUnreachableError) {
    console.warn(`[Processor] User ${commenterId} is unreachable or has blocked DMs.`);
    await prisma.dmLog.update({
      where: {
        automationId_commentId: { automationId, commentId },
      },
      data: {
        status: "FAILED",
        errorMessage: "User cannot be DM'd or has disabled message requests",
      },
    });
    return;
  }

  if (error instanceof TokenExpiredError) {
    tripAccountCooldown(instagramAccountId, "TokenExpired (Code 190)", 60 * 60 * 1000);
    await prisma.dmLog.update({
      where: {
        automationId_commentId: { automationId, commentId },
      },
      data: {
        status: "FAILED",
        errorMessage: "Instagram access token expired or revoked (Code 190)",
      },
    });
    return;
  }

  if (error instanceof RateLimitError) {
    const retryDelay = error.retryAfterMs;
    tripAccountCooldown(instagramAccountId, `RateLimit (Retry in ${retryDelay}ms)`, retryDelay);
    console.warn(`[Processor] Rate limit on comment ${commentId}. Requeuing in ${retryDelay}ms.`);
    await prisma.dmLog.update({
      where: {
        automationId_commentId: { automationId, commentId },
      },
      data: {
        status: "PENDING",
        attempts: attemptsMade + 1,
        errorMessage: `Rate limited by Meta — retry in ${Math.round(retryDelay / 1000)}s`,
      },
    });
    await enqueueJob("process-comment", { ...data, requeueAttempt: requeueAttempt + 1 }, retryDelay);
    return;
  }

  const msg = formatError(error);
  if (
    msg.includes("cannot be found") ||
    msg.includes("cannot be DM'd") ||
    msg.includes("does not exist") ||
    msg.includes("Unsupported post request")
  ) {
    console.warn(`[Processor] Non-retryable Meta error on comment ${commentId}: ${msg}`);
    return;
  }

  throw error;
}
