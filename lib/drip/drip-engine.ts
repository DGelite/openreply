/**
 * OpenReply Drip Campaign Engine
 * Manages automated multi-day / multi-step DM sequences (نردبان پیام / کمپین‌های قطره‌ای).
 * Fully Meta Graph API v25.0 compliant with automatic step progression, 24-hour messaging window enforcement,
 * and account circuit breaker protection.
 */

import { prisma } from "@/lib/db/client";
import { safeDecryptToken } from "@/lib/meta/oauth";
import {
  sendDirectMessage,
  sendDirectMediaMessage,
  sendDirectGenericTemplate,
  sendDirectMessageWithMultipleButtons,
  MediaType,
  MetaButton,
  RateLimitError,
  PolicyBlockError,
  MessagingWindowExpiredError,
  UserUnreachableError,
  TokenExpiredError,
  applyDangerZoneBackoff,
} from "@/lib/meta/client";
import { isAccountInCooldown, tripAccountCooldown } from "@/lib/meta/circuit-breaker";

export interface EnrollUserOptions {
  workspaceId: string;
  instagramAccountId: string;
  userId: string;
  campaignId: string;
  metadata?: Record<string, any>;
}

/**
 * Enrolls a lead/user into a Drip Campaign.
 * Computes the first step execution time based on step 1 delayMinutes.
 */
export async function enrollUserInDrip(options: EnrollUserOptions) {
  const { workspaceId, instagramAccountId, userId, campaignId, metadata = {} } = options;

  const campaign = await prisma.dripCampaign.findUnique({
    where: { id: campaignId },
    include: {
      steps: {
        orderBy: { stepOrder: "asc" },
      },
    },
  });

  if (!campaign || !campaign.isActive || campaign.steps.length === 0) {
    return { success: false, reason: "CAMPAIGN_NOT_FOUND_OR_INACTIVE" };
  }

  const firstStep = campaign.steps[0];
  const delayMinutes = Math.max(0, firstStep.delayMinutes);
  const nextRunAt = new Date(Date.now() + delayMinutes * 60 * 1000);

  const enrollment = await prisma.dripEnrollment.upsert({
    where: {
      campaignId_userId: {
        campaignId,
        userId,
      },
    },
    create: {
      campaignId,
      workspaceId,
      instagramAccountId,
      userId,
      currentStepIndex: 0,
      nextRunAt,
      status: "ACTIVE",
      metadata,
    },
    update: {
      currentStepIndex: 0,
      nextRunAt,
      status: "ACTIVE",
      metadata,
      lastError: null,
    },
  });

  return { success: true, enrollmentId: enrollment.id, nextRunAt };
}

/**
 * Cancels or un-enrolls a user from a drip campaign.
 */
export async function cancelDripEnrollment(campaignId: string, userId: string) {
  return prisma.dripEnrollment.updateMany({
    where: { campaignId, userId },
    data: { status: "CANCELLED" },
  });
}

/**
 * Automatically resumes any paused drip enrollments for a user whose 24-hour window had closed,
 * triggered when the user sends a new incoming DM.
 */
export async function resumeExpiredDripEnrollmentsForUser(
  instagramAccountId: string,
  userId: string
) {
  const pausedEnrollments = await prisma.dripEnrollment.findMany({
    where: {
      instagramAccountId,
      userId,
      status: "PAUSED",
      lastError: {
        contains: "24-hour",
      },
    },
    include: {
      campaign: {
        include: {
          steps: {
            orderBy: { stepOrder: "asc" },
          },
        },
      },
    },
  });

  for (const enrollment of pausedEnrollments) {
    const currentStep = enrollment.campaign?.steps?.[enrollment.currentStepIndex];
    const delayMinutes = currentStep ? Math.max(1, currentStep.delayMinutes) : 1;
    const nextRunAt = new Date(Date.now() + delayMinutes * 60 * 1000);

    await prisma.dripEnrollment.update({
      where: { id: enrollment.id },
      data: {
        status: "ACTIVE",
        nextRunAt,
        lastError: null,
      },
    });
    console.info(
      `[DripEngine] Resumed paused enrollment ${enrollment.id} for user ${userId} following new inbound interaction.`
    );
  }
}

/**
 * Worker tick: Processes all due active drip enrollments whose nextRunAt <= now.
 */
export async function processDueDripEnrollments(limit = 25) {
  const now = new Date();

  const dueEnrollments = await prisma.dripEnrollment.findMany({
    where: {
      status: "ACTIVE",
      nextRunAt: { lte: now },
    },
    include: {
      campaign: {
        include: {
          steps: {
            orderBy: { stepOrder: "asc" },
          },
          workspace: {
            include: {
              instagramAccounts: true,
            },
          },
        },
      },
    },
    take: limit,
  });

  const results: Array<{ enrollmentId: string; status: string; error?: string }> = [];

  for (const enrollment of dueEnrollments) {
    // ── Concurrency Guard: Atomically lease enrollment for 5 minutes ────────
    const claimRes = await prisma.dripEnrollment.updateMany({
      where: {
        id: enrollment.id,
        status: "ACTIVE",
        nextRunAt: enrollment.nextRunAt,
      },
      data: {
        nextRunAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    if (claimRes.count === 0) {
      // Another worker or process already claimed this enrollment
      continue;
    }

    const { campaign } = enrollment;
    const account = campaign.workspace.instagramAccounts.find(
      (a: any) => a.id === enrollment.instagramAccountId
    ) || campaign.workspace.instagramAccounts[0];

    if (!account || !account.accessToken) {
      await prisma.dripEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: "PAUSED",
          lastError: "No valid Instagram access token found",
        },
      });
      results.push({
        enrollmentId: enrollment.id,
        status: "FAILED",
        error: "Missing access token",
      });
      continue;
    }

    // ── Circuit Breaker check ──────────────────────────────────────────────
    const cooldown = isAccountInCooldown(account.instagramId);
    if (cooldown.inCooldown) {
      const delayMs = Math.max(30_000, cooldown.remainingMs);
      await prisma.dripEnrollment.updateMany({
        where: { id: enrollment.id },
        data: {
          nextRunAt: new Date(Date.now() + delayMs),
        },
      });
      console.warn(
        `[DripEngine] Account ${account.instagramId} is in cooldown (${Math.round(
          cooldown.remainingMs / 1000
        )}s remaining). Skipping drip step execution.`
      );
      results.push({
        enrollmentId: enrollment.id,
        status: "SKIPPED_COOLDOWN",
        error: `Account cooldown active (${cooldown.reason})`,
      });
      continue;
    }

    // ── Meta 24-Hour Messaging Policy Guard ────────────────────────────────
    // Standard promotional DMs / Drip sequences MUST NOT be dispatched outside the 24h window.
    const convState = prisma.conversationState
      ? await prisma.conversationState.findUnique({
          where: {
            instagramAccountId_userId: {
              instagramAccountId: account.instagramId,
              userId: enrollment.userId,
            },
          },
        })
      : null;

    const lastInteractedAt = convState?.lastInteractedAt?.getTime() ?? 0;
    const isOutside24Hours = Date.now() - lastInteractedAt > 24 * 60 * 60 * 1000;

    if (isOutside24Hours) {
      console.warn(
        `[DripEngine] 24-Hour messaging window expired for user ${enrollment.userId}. Pausing enrollment safely.`
      );
      await prisma.dripEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: "PAUSED",
          lastError: "24-hour messaging window closed. Will auto-resume on next user DM.",
        },
      });
      results.push({
        enrollmentId: enrollment.id,
        status: "PAUSED_WINDOW_EXPIRED",
        error: "24-hour messaging window closed",
      });
      continue;
    }

    const currentStep = campaign.steps[enrollment.currentStepIndex];
    if (!currentStep) {
      // Completed all steps
      await prisma.dripEnrollment.update({
        where: { id: enrollment.id },
        data: { status: "COMPLETED" },
      });
      results.push({ enrollmentId: enrollment.id, status: "COMPLETED" });
      continue;
    }

    const accessToken = safeDecryptToken(account.accessToken);
    if (!accessToken) {
      await prisma.dripEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: "PAUSED",
          lastError: "Invalid Instagram access token",
        },
      });
      results.push({
        enrollmentId: enrollment.id,
        status: "FAILED",
        error: "Missing or invalid token",
      });
      continue;
    }

    try {
      await applyDangerZoneBackoff();

      // Deliver step content based on messageType
      if (currentStep.messageType === "MEDIA" && currentStep.mediaUrl) {
        await sendDirectMediaMessage(
          accessToken,
          account.instagramId,
          enrollment.userId,
          "image",
          currentStep.mediaUrl
        );
      } else if (currentStep.messageType === "CAROUSEL") {
        const rawButtons = (currentStep.buttons as any[]) || [];
        const buttons: MetaButton[] = rawButtons.map((b) => ({
          type: b.type || "web_url",
          title: (b.title || "مشاهده").slice(0, 20),
          url: b.url,
          payload: b.payload,
        }));

        await sendDirectGenericTemplate(
          accessToken,
          account.instagramId,
          enrollment.userId,
          [
            {
              title: currentStep.messageText?.slice(0, 80) || campaign.name.slice(0, 80),
              subtitle: campaign.description?.slice(0, 80),
              image_url: currentStep.mediaUrl || undefined,
              buttons: buttons.length > 0 ? buttons.slice(0, 3) : undefined,
            },
          ]
        );
      } else {
        // TEXT or BUTTONS
        const rawButtons = (currentStep.buttons as any[]) || [];
        const buttons: MetaButton[] = rawButtons.map((b) => ({
          type: b.type || "web_url",
          title: (b.title || "مشاهده").slice(0, 20),
          url: b.url,
          payload: b.payload,
        }));

        if (buttons.length > 0) {
          await sendDirectMessageWithMultipleButtons(
            accessToken,
            account.instagramId,
            enrollment.userId,
            currentStep.messageText || "",
            buttons.slice(0, 3)
          );
        } else {
          await sendDirectMessage(
            accessToken,
            account.instagramId,
            enrollment.userId,
            currentStep.messageText || ""
          );
        }
      }

      // Schedule next step or finish
      const nextIndex = enrollment.currentStepIndex + 1;
      if (nextIndex < campaign.steps.length) {
        const nextStep = campaign.steps[nextIndex];
        const nextRun = new Date(Date.now() + Math.max(1, nextStep.delayMinutes) * 60 * 1000);

        await prisma.dripEnrollment.update({
          where: { id: enrollment.id },
          data: {
            currentStepIndex: nextIndex,
            nextRunAt: nextRun,
            lastError: null,
          },
        });
        results.push({ enrollmentId: enrollment.id, status: "ADVANCED_TO_STEP_" + nextIndex });
      } else {
        await prisma.dripEnrollment.update({
          where: { id: enrollment.id },
          data: {
            status: "COMPLETED",
            lastError: null,
          },
        });
        results.push({ enrollmentId: enrollment.id, status: "COMPLETED" });
      }
    } catch (err: any) {
      console.error(`[DripEngine] Error delivering step for enrollment ${enrollment.id}:`, err);

      if (err instanceof PolicyBlockError) {
        tripAccountCooldown(account.instagramId, "PolicyBlock (Code 368)", 30 * 60 * 1000);
      } else if (err instanceof RateLimitError) {
        tripAccountCooldown(account.instagramId, `RateLimit (Retry in ${err.retryAfterMs}ms)`, err.retryAfterMs);
      } else if (err instanceof MessagingWindowExpiredError) {
        await prisma.dripEnrollment.update({
          where: { id: enrollment.id },
          data: {
            status: "PAUSED",
            lastError: "24-hour messaging window closed. Meta rejected DM.",
          },
        });
        results.push({ enrollmentId: enrollment.id, status: "PAUSED_WINDOW_EXPIRED", error: err.message });
        continue;
      } else if (err instanceof UserUnreachableError) {
        await prisma.dripEnrollment.update({
          where: { id: enrollment.id },
          data: {
            status: "CANCELLED",
            lastError: "User unreachable or blocked DM.",
          },
        });
        results.push({ enrollmentId: enrollment.id, status: "CANCELLED", error: err.message });
        continue;
      } else if (err instanceof TokenExpiredError) {
        tripAccountCooldown(account.instagramId, "TokenExpired (Code 190)", 60 * 60 * 1000);
      }

      await prisma.dripEnrollment.update({
        where: { id: enrollment.id },
        data: {
          lastError: err?.message || String(err),
        },
      });
      results.push({ enrollmentId: enrollment.id, status: "ERROR", error: err?.message });
    }
  }

  return results;
}
