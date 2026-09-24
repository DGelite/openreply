import { prisma } from "@/lib/db/client";
import {
  MetaApiError,
  RateLimitError,
  PolicyBlockError,
  CommentAlreadyRepliedError,
  MessagingWindowExpiredError,
  UserUnreachableError,
  TokenExpiredError,
  sendCommentReply,
  sendDirectMessage,
  sendDirectMessageWithLinkButton,
  sendPrivateReply,
  sendPrivateReplyWithButton,
  sendPrivateReplyWithLinkButton,
  isInDangerZone,
  isAtCriticalLimit,
  calculateUsageBackoffMs,
  getLastAppUsagePercent,
  applyDangerZoneBackoff,
} from "@/lib/meta/client";
import { isAccountInCooldown, tripAccountCooldown } from "@/lib/meta/circuit-breaker";
import { safeDecryptToken } from "@/lib/meta/oauth";
import { matchKeywords } from "@/lib/utils/keyword-matcher";
import { reserveDMSlot } from "@/lib/utils/rate-limiter";
import {
  releaseWorkspaceDMReservation,
  reserveWorkspaceDMSend,
} from "@/lib/billing/usage";
import { recordWorkerAlert } from "@/lib/ops/worker-health";
import { selectDmMessageVariation } from "@/lib/automation/ab-testing";
import {
  buildTrackedUrl,
  renderMessageWithTracking,
  renderMessageWithoutLink,
} from "@/lib/tracking/message";
import { ProcessCommentJob, ProcessPostbackJob, enqueueJob } from "./mysql-queue";
import { executeFlowGraph } from "@/lib/flow/flow-engine";
import type { FlowGraph } from "@/lib/flow/types";

function formatError(error: unknown): string {
  if (error instanceof MetaApiError) {
    return `Meta API Error ${error.code}: ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}
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
    const replyPool =
      Array.isArray(automation.publicReplyMessages) && automation.publicReplyMessages.length > 0
        ? (automation.publicReplyMessages as string[])
        : automation.publicReplyMessage
          ? [automation.publicReplyMessage]
          : [];
    if (
      automation.publicReplyEnabled &&
      replyPool.length > 0 &&
      !existingLog?.publicReplySentAt
    ) {
      try {
        await applyDangerZoneBackoff();
        const chosen = replyPool[Math.floor(Math.random() * replyPool.length)];
        const publicReply = renderMessageWithTracking({
          message: chosen,
          commenterName,
          trackedLinks: automation.trackedLinks,
        });
        await sendCommentReply(accessToken, commentId, publicReply);
        await prisma.dmLog.update({
          where: {
            automationId_commentId: { automationId: automation.id, commentId },
          },
          data: { publicReplySentAt: new Date(), publicReplyError: null },
        });
      } catch (error) {
        console.error(
          "[DM Processor] Public comment reply failed:",
          formatError(error)
        );
        await prisma.dmLog
          .update({
            where: {
              automationId_commentId: { automationId: automation.id, commentId },
            },
            data: { publicReplyError: formatError(error) },
          })
          .catch(() => {});
      }
    }

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

    const hasFlowGraph =
      automation.flowGraph &&
      typeof automation.flowGraph === "object" &&
      Array.isArray((automation.flowGraph as any).nodes) &&
      (automation.flowGraph as any).nodes.length > 0;

    try {
      // ── Apply danger zone backoff before every Meta send ────────────────
      await applyDangerZoneBackoff();

      if (hasFlowGraph) {
        const graphResults = await executeFlowGraph(
          automation.flowGraph as unknown as FlowGraph,
          {
            workspaceId: automation.workspaceId,
            instagramAccountId: automation.instagramAccount.instagramId,
            userId: commenterId,
            username: commenterName,
            userMessage: commentText,
          }
        );

        for (const step of graphResults) {
          if (step.requiresInput) {
            await prisma.conversationState.upsert({
              where: {
                instagramAccountId_userId: {
                  instagramAccountId: automation.instagramAccount.instagramId,
                  userId: commenterId,
                },
              },
              create: {
                workspaceId: automation.workspaceId,
                instagramAccountId: automation.instagramAccount.instagramId,
                userId: commenterId,
                step: step.requiresInput,
                automationId: automation.id,
              },
              update: {
                step: step.requiresInput,
                automationId: automation.id,
              },
            });
            if (step.dmMessageToSend) {
              const bodyText = renderMessageWithTracking({
                message: step.dmMessageToSend,
                commenterName,
                trackedLinks: automation.trackedLinks,
              });
              await sendPrivateReply(
                accessToken,
                automation.instagramAccount.instagramId,
                commentId,
                bodyText
              );
            }
            break;
          }

          if (step.dmMessageToSend) {
            if (step.linkButton) {
              await sendPrivateReplyWithLinkButton(
                accessToken,
                automation.instagramAccount.instagramId,
                commentId,
                step.dmMessageToSend,
                step.linkButton.label,
                step.linkButton.url
              );
            } else {
              const dmMessage = renderMessageWithTracking({
                message: step.dmMessageToSend,
                commenterName,
                trackedLinks: automation.trackedLinks,
              });
              await sendPrivateReply(
                accessToken,
                automation.instagramAccount.instagramId,
                commentId,
                dmMessage
              );
            }
          }
        }

        await prisma.dmLog.update({
          where: {
            automationId_commentId: {
              automationId: automation.id,
              commentId,
            },
          },
          data: {
            status: "SENT",
            dmSentAt: new Date(),
            errorMessage: null,
          },
        });
        continue;
      }

      const useOpeningDm =
        automation.openingDmEnabled &&
        Boolean(automation.openingDmMessage) &&
        Boolean(automation.openingDmButtonLabel);

      if (useOpeningDm) {
        const openingText = renderMessageWithTracking({
          message: automation.openingDmMessage as string,
          commenterName,
          trackedLinks: [],
        });
        await sendPrivateReplyWithButton(
          accessToken,
          automation.instagramAccount.instagramId,
          commentId,
          openingText,
          automation.openingDmButtonLabel as string,
          `reveal:${automation.id}`
        );
      } else if (automation.trackedLinks[0]) {
        const selectedMessage = selectDmMessageVariation(automation.dmMessage);
        const bodyText =
          renderMessageWithoutLink({
            message: selectedMessage,
            commenterName,
          }) || "Here's your link:";
        await sendPrivateReplyWithLinkButton(
          accessToken,
          automation.instagramAccount.instagramId,
          commentId,
          bodyText,
          automation.linkButtonLabel || "Open link",
          buildTrackedUrl(automation.trackedLinks[0].slug)
        );
      } else {
        const selectedMessage = selectDmMessageVariation(automation.dmMessage);
        const dmMessage = renderMessageWithTracking({
          message: selectedMessage,
          commenterName,
          trackedLinks: automation.trackedLinks,
        });
        await sendPrivateReply(
          accessToken,
          automation.instagramAccount.instagramId,
          commentId,
          dmMessage
        );
      }

      await prisma.dmLog.update({
        where: {
          automationId_commentId: {
            automationId: automation.id,
            commentId,
          },
        },
        data: {
          status: "SENT",
          dmSentAt: new Date(),
          errorMessage: null,
        },
      });
    } catch (error) {
      await releaseWorkspaceDMReservation(
        automation.workspaceId,
        usage.periodStart
      );

      if (error instanceof PolicyBlockError) {
        tripAccountCooldown(instagramAccountId, "PolicyBlock (Code 368)", 30 * 60 * 1000);
        await prisma.dmLog.update({
          where: {
            automationId_commentId: { automationId: automation.id, commentId },
          },
          data: {
            status: "PENDING",
            attempts: attemptsMade + 1,
            errorMessage: "Temporary Meta policy cooldown active — retry scheduled in 30m",
          },
        });
        await enqueueJob("process-comment", { ...data, requeueAttempt: requeueAttempt + 1 }, 30 * 60 * 1000);
        continue;
      }

      if (error instanceof CommentAlreadyRepliedError) {
        console.info(`[Processor] Comment ${commentId} already replied to via private reply.`);
        await prisma.dmLog.update({
          where: {
            automationId_commentId: { automationId: automation.id, commentId },
          },
          data: {
            status: "SENT",
            errorMessage: "Already replied to comment (Meta Subcode 2534015)",
          },
        });
        continue;
      }

      if (error instanceof MessagingWindowExpiredError) {
        console.warn(`[Processor] 7-day comment window or messaging window expired for comment ${commentId}.`);
        await prisma.dmLog.update({
          where: {
            automationId_commentId: { automationId: automation.id, commentId },
          },
          data: {
            status: "FAILED",
            errorMessage: "7-day comment window or messaging window expired (Meta policy)",
          },
        });
        continue;
      }

      if (error instanceof UserUnreachableError) {
        console.warn(`[Processor] User ${commenterId} is unreachable or has blocked DMs.`);
        await prisma.dmLog.update({
          where: {
            automationId_commentId: { automationId: automation.id, commentId },
          },
          data: {
            status: "FAILED",
            errorMessage: "User cannot be DM'd or has disabled message requests",
          },
        });
        continue;
      }

      if (error instanceof TokenExpiredError) {
        tripAccountCooldown(instagramAccountId, "TokenExpired (Code 190)", 60 * 60 * 1000);
        await prisma.dmLog.update({
          where: {
            automationId_commentId: { automationId: automation.id, commentId },
          },
          data: {
            status: "FAILED",
            errorMessage: "Instagram access token expired or revoked (Code 190)",
          },
        });
        continue;
      }

      // ── Rate limit error: schedule a retry with backoff ──────────────────
      if (error instanceof RateLimitError) {
        const retryDelay = error.retryAfterMs;
        tripAccountCooldown(instagramAccountId, `RateLimit (Retry in ${retryDelay}ms)`, retryDelay);
        console.warn(`[Processor] Rate limit on comment ${commentId}. Requeuing in ${retryDelay}ms.`);
        await prisma.dmLog.update({
          where: {
            automationId_commentId: { automationId: automation.id, commentId },
          },
          data: {
            status: "PENDING",
            attempts: attemptsMade + 1,
            errorMessage: `Rate limited by Meta — retry in ${Math.round(retryDelay / 1000)}s`,
          },
        });
        await enqueueJob("process-comment", { ...data, requeueAttempt: requeueAttempt + 1 }, retryDelay);
        continue;
      }

      const msg = formatError(error);
      if (
        msg.includes("cannot be found") ||
        msg.includes("cannot be DM'd") ||
        msg.includes("does not exist") ||
        msg.includes("Unsupported post request")
      ) {
        console.warn(`[Processor] Non-retryable Meta error on comment ${commentId}: ${msg}`);
        continue;
      }

      throw error;
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

  const primaryLink = automation.trackedLinks[0];

  try {
    // Apply danger zone backoff before sending reveal message
    await applyDangerZoneBackoff();

    if (primaryLink) {
      const bodyText =
        renderMessageWithoutLink({
          message: automation.dmMessage,
          commenterName,
        }) || "Here's your link:";
      await sendDirectMessageWithLinkButton(
        accessToken,
        automation.instagramAccount.instagramId,
        userId,
        bodyText,
        automation.linkButtonLabel || "Open link",
        buildTrackedUrl(primaryLink.slug)
      );
    } else {
      const revealMessage = renderMessageWithTracking({
        message: automation.dmMessage,
        commenterName,
        trackedLinks: automation.trackedLinks,
      });
      await sendDirectMessage(
        accessToken,
        automation.instagramAccount.instagramId,
        userId,
        revealMessage
      );
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
        status: "SENT",
        dmSentAt: new Date(),
      },
      update: { status: "SENT", dmSentAt: new Date(), errorMessage: null },
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
