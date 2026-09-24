import { prisma } from "@/lib/db/client";
import { safeDecryptToken } from "@/lib/meta/oauth";
import {
  sendDirectMessage as rawSendDirectMessage,
  sendDirectMessageWithLinkButton as rawSendDirectMessageWithLinkButton,
  sendDirectMediaMessage as rawSendDirectMediaMessage,
  sendDirectGenericTemplate as rawSendDirectGenericTemplate,
  sendDirectQuickReplies as rawSendDirectQuickReplies,
  sendDirectMessageWithMultipleButtons as rawSendDirectMessageWithMultipleButtons,
  RateLimitError,
  PolicyBlockError,
  TokenExpiredError,
  MessagingWindowExpiredError,
  UserUnreachableError,
  applyDangerZoneBackoff,
} from "@/lib/meta/client";
import { isAccountInCooldown, tripAccountCooldown } from "@/lib/meta/circuit-breaker";
import { reserveDMSlot } from "@/lib/utils/rate-limiter";
import { enqueueJob } from "@/lib/queue/mysql-queue";
import { processLeadStep } from "./email-phone-collector";
import { registerGiveawayEntry } from "./giveaway-engine";
import { claimCoupon } from "./coupon-engine";
import { matchFaq } from "./faq-engine";
import { matchKeywords } from "@/lib/utils/keyword-matcher";
import { validatePhone } from "./email-phone-collector";
import { savePhoneLeadDirectly } from "./email-phone-collector";
import { checkHumanHandoverState, setHumanHandover } from "./human-handover";
import { generateSmartResponse } from "@/lib/ai/features/smart-responses";
import { executeFlowGraph, type FlowStepResult } from "@/lib/flow/flow-engine";
import type { FlowGraph } from "@/lib/flow/types";
import { addTagToLead, removeTagFromLead, getLeadTags } from "@/lib/crm/tags";
import { enrollUserInDrip, resumeExpiredDripEnrollmentsForUser } from "@/lib/drip/drip-engine";

export interface IncomingDirectMessageEvent {
  instagramAccountId: string; // IGSID of connected account
  userId: string; // Sender's IGSID
  username?: string;
  messageText: string;
  mid?: string;
  isStoryReply?: boolean;
  isStoryMention?: boolean;
  isStoryReaction?: boolean;
  storyMediaId?: string;
  quickReplyPayload?: string;
  requeueAttempt?: number;
}

interface DmSenderHelpers {
  sendDirectMessage: (t: string, accId: string, uId: string, msg: string) => Promise<any>;
  sendDirectMessageWithLinkButton: (t: string, accId: string, uId: string, msg: string, lbl: string, url: string) => Promise<any>;
  sendDirectMediaMessage: (t: string, accId: string, uId: string, type: "image" | "video" | "audio", url: string) => Promise<any>;
  sendDirectGenericTemplate: (t: string, accId: string, uId: string, elements: any[]) => Promise<any>;
  sendDirectQuickReplies: (t: string, accId: string, uId: string, text: string, quickReplies: any[]) => Promise<any>;
  sendDirectMessageWithMultipleButtons: (t: string, accId: string, uId: string, text: string, buttons: any[]) => Promise<any>;
}

/**
 * Handles incoming direct messages, story replies, story mentions, and quick replies.
 * Fully supports Visual Flow Builder multi-branching, CRM tags, Drip campaigns, and Rich Templates.
 */
export async function processIncomingDirectMessage(
  event: IncomingDirectMessageEvent,
  attemptsMade: number = 0
): Promise<void> {
  const {
    instagramAccountId,
    userId,
    username,
    messageText,
    isStoryReply,
    isStoryMention,
    isStoryReaction,
    quickReplyPayload,
    requeueAttempt = 0,
  } = event;

  const effectiveAttempts = Math.max(attemptsMade, requeueAttempt);

  const safeSend = async <T>(action: () => Promise<T>): Promise<T | void> => {
    const cooldown = isAccountInCooldown(instagramAccountId);
    if (cooldown.inCooldown) {
      const delay = Math.max(30_000, cooldown.remainingMs);
      await enqueueJob("process-dm", { ...event, requeueAttempt: effectiveAttempts + 1 }, delay);
      return;
    }

    const rateLimit = await reserveDMSlot(instagramAccountId, "DIRECT_MESSAGE", effectiveAttempts);
    if (rateLimit.shouldSkip) return;
    if (rateLimit.shouldRequeue) {
      await enqueueJob("process-dm", { ...event, requeueAttempt: effectiveAttempts + 1 }, rateLimit.requeueDelayMs);
      return;
    }
    try {
      await applyDangerZoneBackoff();
      return await action();
    } catch (error) {
      if (error instanceof PolicyBlockError) {
        tripAccountCooldown(instagramAccountId, "PolicyBlock (Code 368)", 30 * 60 * 1000);
        await enqueueJob("process-dm", { ...event, requeueAttempt: effectiveAttempts + 1 }, 30 * 60 * 1000);
      } else if (error instanceof RateLimitError) {
        tripAccountCooldown(instagramAccountId, `RateLimit (Retry in ${error.retryAfterMs}ms)`, error.retryAfterMs);
        await enqueueJob("process-dm", { ...event, requeueAttempt: effectiveAttempts + 1 }, error.retryAfterMs);
      } else if (error instanceof TokenExpiredError) {
        tripAccountCooldown(instagramAccountId, "TokenExpired (Code 190)", 60 * 60 * 1000);
      } else if (error instanceof UserUnreachableError || error instanceof MessagingWindowExpiredError) {
        console.warn(`[DM Processor] Non-retryable Meta error for user ${userId}:`, error.message);
      } else if (error instanceof Error && (error.message.includes("fetch failed") || error.message.includes("ENOTFOUND"))) {
        console.warn(`[DM Processor] Network connection error sending DM (${error.message}). Will retry or skip silently.`);
      } else {
        throw error;
      }
    }
  };

  const sendDirectMessage = (t: string, accId: string, uId: string, msg: string) => 
    safeSend(() => rawSendDirectMessage(t, accId, uId, msg));
  
  const sendDirectMessageWithLinkButton = (t: string, accId: string, uId: string, msg: string, lbl: string, url: string) => 
    safeSend(() => rawSendDirectMessageWithLinkButton(t, accId, uId, msg, lbl, url));

  const sendDirectMediaMessage = (t: string, accId: string, uId: string, type: "image" | "video" | "audio", url: string) =>
    safeSend(() => rawSendDirectMediaMessage(t, accId, uId, type, url));

  const sendDirectGenericTemplate = (t: string, accId: string, uId: string, elements: any[]) =>
    safeSend(() => rawSendDirectGenericTemplate(t, accId, uId, elements));

  const sendDirectQuickReplies = (t: string, accId: string, uId: string, text: string, quickReplies: any[]) =>
    safeSend(() => rawSendDirectQuickReplies(t, accId, uId, text, quickReplies));

  const sendDirectMessageWithMultipleButtons = (t: string, accId: string, uId: string, text: string, buttons: any[]) =>
    safeSend(() => rawSendDirectMessageWithMultipleButtons(t, accId, uId, text, buttons));

  const account = await prisma.instagramAccount.findUnique({
    where: { instagramId: instagramAccountId },
    include: { workspace: true },
  });

  if (!account || !account.accessToken) return;

  let accessToken: string;
  try {
    accessToken = safeDecryptToken(account.accessToken);
  } catch {
    return;
  }

  // ── 0. Update 24-Hour Messaging Window & Resume Paused Drips ────────────
  await prisma.conversationState.upsert({
    where: {
      instagramAccountId_userId: { instagramAccountId, userId },
    },
    create: {
      workspaceId: account.workspaceId,
      instagramAccountId,
      userId,
      lastInteractedAt: new Date(),
    },
    update: {
      lastInteractedAt: new Date(),
    },
  });

  // Re-activate any drip campaigns that were safely paused when the 24h window closed
  await resumeExpiredDripEnrollmentsForUser(instagramAccountId, userId).catch((err) => {
    console.warn("[DM Processor] Error resuming paused drip enrollments:", err);
  });

  // ── 1. Human Handover Check ──────────────────────────────────────────────
  const handoverState = await checkHumanHandoverState(
    account.workspaceId,
    instagramAccountId,
    userId,
    messageText
  );
  if (handoverState.isHandover) {
    console.log(
      `[DM Processor] Human handover active for user ${userId}. Skipping automation. Reason: ${handoverState.reason}`
    );
    return;
  }

  // ── 2. Active Flow or Lead Collection State ──────────────────────────────
  const conversationState = await prisma.conversationState.findUnique({
    where: {
      instagramAccountId_userId: { instagramAccountId, userId },
    },
  });

  // Check lead prompt step
  if (
    conversationState &&
    (conversationState.step === "AWAITING_EMAIL" ||
      conversationState.step === "AWAITING_PHONE")
  ) {
    const leadResult = await processLeadStep({
      workspaceId: account.workspaceId,
      instagramAccountId,
      userId,
      username,
      userMessage: messageText,
      currentStep: conversationState.step,
      automationId: conversationState.automationId ?? undefined,
    });

    if (leadResult.replyMessage) {
      await sendDirectMessage(
        accessToken,
        instagramAccountId,
        userId,
        leadResult.replyMessage
      );
    }
    return;
  }

  // Check Flow Node resumption (e.g. quick reply chip clicked or flow response)
  if (
    conversationState &&
    conversationState.step === "FLOW_NODE" &&
    conversationState.automationId
  ) {
    const activeAutomation = await prisma.automation.findUnique({
      where: { id: conversationState.automationId },
    });

    if (
      activeAutomation &&
      activeAutomation.flowGraph &&
      typeof activeAutomation.flowGraph === "object"
    ) {
      const userTags = await getLeadTags(account.workspaceId, userId);
      const graphResults = await executeFlowGraph(
        activeAutomation.flowGraph as unknown as FlowGraph,
        {
          workspaceId: account.workspaceId,
          instagramAccountId: account.instagramId,
          userId,
          username,
          userMessage: messageText,
          userTags,
          selectedQuickReplyPayload: quickReplyPayload,
        },
        conversationState.activeNodeId ?? undefined
      );

      await handleFlowExecutionResults(
        graphResults,
        activeAutomation,
        account,
        accessToken,
        userId,
        username,
        {
          sendDirectMessage,
          sendDirectMessageWithLinkButton,
          sendDirectMediaMessage,
          sendDirectGenericTemplate,
          sendDirectQuickReplies,
          sendDirectMessageWithMultipleButtons,
        }
      );
      return;
    }
  }

  // ── 3. Determine Trigger Type ────────────────────────────────────────────
  let triggerType: "STORY_MENTION" | "STORY_REPLY" | "STORY_REACTION" | "DIRECT_MESSAGE" =
    "DIRECT_MESSAGE";

  if (isStoryReaction) {
    triggerType = "STORY_REACTION";
  } else if (isStoryMention) {
    triggerType = "STORY_MENTION";
  } else if (isStoryReply) {
    triggerType = "STORY_REPLY";
  }

  // ── 4. Find Matching Active Automations ──────────────────────────────────
  const automations = await prisma.automation.findMany({
    where: {
      instagramAccountId: account.id,
      isActive: true,
      triggerType: {
        in: [triggerType, "FAQ", "GIVEAWAY", "LEAD_MAGNET", "COUPON", "WELCOME", "DIRECT_MESSAGE"],
      },
    },
    include: {
      trackedLinks: true,
      giveaways: { where: { status: "ACTIVE" } },
      couponPools: true,
    },
    orderBy: { createdAt: "asc" },
  });

  for (const automation of automations) {
    const isTriggerMatch =
      automation.triggerType === triggerType ||
      automation.triggerType === "DIRECT_MESSAGE";

    const keywordMatch = automation.matchAnyWord
      ? { matched: true, matchedKeyword: null }
      : matchKeywords(
          messageText,
          automation.keywords as string[],
          automation.wholeWordMatch
        );

    if (!isTriggerMatch || !keywordMatch.matched) {
      continue;
    }

    try {
      // ── 0. Visual Flow Graph Execution ─────────────────────────────────────
      if (
        automation.flowGraph &&
        typeof automation.flowGraph === "object" &&
        Array.isArray((automation.flowGraph as any).nodes) &&
        (automation.flowGraph as any).nodes.length > 0
      ) {
        const userTags = await getLeadTags(account.workspaceId, userId);
        const graphResults = await executeFlowGraph(
          automation.flowGraph as unknown as FlowGraph,
          {
            workspaceId: account.workspaceId,
            instagramAccountId: account.instagramId,
            userId,
            username,
            userMessage: messageText,
            userTags,
            selectedQuickReplyPayload: quickReplyPayload,
          }
        );

        await handleFlowExecutionResults(
          graphResults,
          automation,
          account,
          accessToken,
          userId,
          username,
          {
            sendDirectMessage,
            sendDirectMessageWithLinkButton,
            sendDirectMediaMessage,
            sendDirectGenericTemplate,
            sendDirectQuickReplies,
            sendDirectMessageWithMultipleButtons,
          }
        );
        return;
      }

      // ── A. Lead Magnet Delivery ──────────────────────────────────────────
      if (automation.triggerType === "LEAD_MAGNET" || automation.leadMagnetFileUrl) {
        const message =
          automation.dmMessage || "فایل درخواستی شما آماده دانلود است:";
        const linkUrl =
          automation.leadMagnetFileUrl ||
          (automation.trackedLinks[0]?.destinationUrl ?? "");

        if (linkUrl) {
          await sendDirectMessageWithLinkButton(
            accessToken,
            instagramAccountId,
            userId,
            message,
            automation.linkButtonLabel || "دانلود فایل",
            linkUrl
          );
        } else {
          await sendDirectMessage(
            accessToken,
            instagramAccountId,
            userId,
            message
          );
        }
        return;
      }

      // ── B. Coupon Delivery ───────────────────────────────────────────────
      if (automation.triggerType === "COUPON" && automation.couponPools[0]) {
        const couponResult = await claimCoupon({
          poolId: automation.couponPools[0].id,
          userId,
        });

        await sendDirectMessage(
          accessToken,
          instagramAccountId,
          userId,
          `${automation.dmMessage}\n\n${couponResult.message}`
        );
        return;
      }

      // ── C. Giveaway Registration ─────────────────────────────────────────
      if (automation.triggerType === "GIVEAWAY" && automation.giveaways[0]) {
        const giveawayResult = await registerGiveawayEntry({
          giveawayId: automation.giveaways[0].id,
          userId,
          username,
          entryTrigger: isStoryReply ? "STORY" : isStoryMention ? "STORY" : "DM",
        });

        await sendDirectMessage(
          accessToken,
          instagramAccountId,
          userId,
          `${automation.dmMessage}\n\n${giveawayResult.message}`
        );
        return;
      }

      // ── D. Email / Phone Collection Prompting ────────────────────────────
      if (automation.collectEmail || automation.collectPhone) {
        if (automation.collectPhoneSkipOtp && validatePhone(messageText)) {
          await savePhoneLeadDirectly({
            phone: messageText,
            username,
            igsid: userId,
            workspaceId: account.workspaceId,
            instagramAccountId,
            automationId: automation.id,
          });

          await sendDirectMessage(
            accessToken,
            instagramAccountId,
            userId,
            automation.leadSuccessMessage || "اطلاعات شما با موفقیت ثبت شد!"
          );
          return;
        }

        const initialStep = automation.collectEmail
          ? "AWAITING_EMAIL"
          : "AWAITING_PHONE";

        await prisma.conversationState.upsert({
          where: {
            instagramAccountId_userId: { instagramAccountId, userId },
          },
          create: {
            workspaceId: account.workspaceId,
            instagramAccountId,
            userId,
            step: initialStep,
            automationId: automation.id,
          },
          update: {
            step: initialStep,
            automationId: automation.id,
          },
        });

        const promptText =
          initialStep === "AWAITING_EMAIL"
            ? automation.leadPromptEmail || "لطفاً ایمیل خود را وارد کنید:"
            : automation.leadPromptPhone || "لطفاً شماره همراه خود را وارد کنید:";

        await sendDirectMessage(
          accessToken,
          instagramAccountId,
          userId,
          promptText
        );
        return;
      }

      // ── E. Standard Direct DM / Story Reply / Mention Response ──────────
      if (automation.trackedLinks[0]) {
        await sendDirectMessageWithLinkButton(
          accessToken,
          instagramAccountId,
          userId,
          automation.dmMessage,
          automation.linkButtonLabel || "مشاهده لینک",
          automation.trackedLinks[0].destinationUrl
        );
      } else {
        await sendDirectMessage(
          accessToken,
          instagramAccountId,
          userId,
          automation.dmMessage
        );
      }
      return;

    } catch (error) {
      if (error instanceof RateLimitError) {
        console.warn(
          `[DM Processor] Rate limited sending DM to user ${userId}. Will retry after ${error.retryAfterMs}ms.`
        );
        throw error;
      }
      console.error("[DM Processor] Error processing DM automation:", error instanceof Error ? error.message : error);
      throw error;
    }
  }

  // ── 5. FAQ Fallback ──────────────────────────────────────────────────────
  const faqResult = await matchFaq({
    workspaceId: account.workspaceId,
    instagramAccountId,
    messageText,
  });

  if (faqResult.matched && faqResult.answerText) {
    try {
      if (faqResult.linkUrl) {
        await sendDirectMessageWithLinkButton(
          accessToken,
          instagramAccountId,
          userId,
          faqResult.answerText,
          "اطلاعات بیشتر",
          faqResult.linkUrl
        );
      } else {
        await sendDirectMessage(
          accessToken,
          instagramAccountId,
          userId,
          faqResult.answerText
        );
      }
      return;
    } catch (error) {
      if (error instanceof RateLimitError) {
        console.warn(`[DM Processor] Rate limited sending FAQ reply to ${userId}.`);
        throw error;
      }
      throw error;
    }
  }

  // ── 6. AI Agent Smart Response Fallback ──────────────────────────────────
  try {
    const aiConfig = await prisma.aiConfig.findUnique({
      where: { workspaceId: account.workspaceId },
    });

    if (!aiConfig || !aiConfig.isEnabled) {
      return;
    }

    const smartReply = await generateSmartResponse({
      workspaceId: account.workspaceId,
      userId,
      userMessage: messageText,
    });

    if (smartReply) {
      await sendDirectMessage(
        accessToken,
        instagramAccountId,
        userId,
        smartReply
      );
    }
  } catch (aiError) {
    console.error(
      "[AI Agent Error] Failed to generate or send AI response:",
      aiError instanceof Error ? aiError.stack || aiError.message : aiError
    );
  }
}

/**
 * Handles the execution results of an interactive Flow Graph.
 */
async function handleFlowExecutionResults(
  graphResults: FlowStepResult[],
  automation: any,
  account: any,
  accessToken: string,
  userId: string,
  username: string | undefined,
  senders: DmSenderHelpers
) {
  for (const step of graphResults) {
    // 1. Handle CRM Tag Actions
    if (step.tagAction) {
      if (step.tagAction.action === "add") {
        await addTagToLead(account.workspaceId, account.instagramId, userId, step.tagAction.tagName);
      } else {
        await removeTagFromLead(account.workspaceId, userId, step.tagAction.tagName);
      }
    }

    if (step.enrollDripCampaignId) {
      await enrollUserInDrip({
        workspaceId: account.workspaceId,
        instagramAccountId: account.instagramId,
        userId,
        campaignId: step.enrollDripCampaignId,
      });
    }

    if (step.isHumanHandover) {
      await setHumanHandover(
        account.workspaceId,
        account.instagramId,
        userId,
        true
      );
    }

    // 2. Handle pausing for next interactive input / quick replies
    if (step.requiresInput) {
      await prisma.conversationState.upsert({
        where: {
          instagramAccountId_userId: {
            instagramAccountId: account.instagramId,
            userId,
          },
        },
        create: {
          workspaceId: account.workspaceId,
          instagramAccountId: account.instagramId,
          userId,
          step: step.requiresInput,
          automationId: automation.id,
        },
        update: {
          step: step.requiresInput,
          automationId: automation.id,
        },
      });
    }

    // 3. Dispatch Visual Media / Carousels / Quick Replies / Text
    if (step.mediaToSend) {
      await senders.sendDirectMediaMessage(
        accessToken,
        account.instagramId,
        userId,
        step.mediaToSend.mediaType,
        step.mediaToSend.mediaUrl
      );
    } else if (step.carouselToSend && step.carouselToSend.cards.length > 0) {
      const genericElements = step.carouselToSend.cards.map((c) => ({
        title: c.title,
        subtitle: c.subtitle,
        image_url: c.imageUrl,
        buttons: c.buttons.map((b) => ({
          type: "web_url" as const,
          title: b.title,
          url: b.url || "#",
        })),
      }));
      await senders.sendDirectGenericTemplate(
        accessToken,
        account.instagramId,
        userId,
        genericElements
      );
    } else if (step.quickRepliesToSend && step.quickRepliesToSend.chips.length > 0) {
      const qrOptions = step.quickRepliesToSend.chips.map((chip) => ({
        content_type: "text" as const,
        title: chip.title,
        payload: chip.payload || chip.title,
      }));
      await senders.sendDirectQuickReplies(
        accessToken,
        account.instagramId,
        userId,
        step.quickRepliesToSend.text || step.dmMessageToSend || "یک گزینه را انتخاب کنید:",
        qrOptions
      );
    } else if (step.buttons && step.buttons.length > 0) {
      const metaButtons = step.buttons.map((b) => ({
        type: b.type,
        title: b.title,
        url: b.url,
        payload: b.payload,
      }));
      await senders.sendDirectMessageWithMultipleButtons(
        accessToken,
        account.instagramId,
        userId,
        step.dmMessageToSend || "",
        metaButtons
      );
    } else if (step.linkButton && step.dmMessageToSend) {
      await senders.sendDirectMessageWithLinkButton(
        accessToken,
        account.instagramId,
        userId,
        step.dmMessageToSend,
        step.linkButton.label,
        step.linkButton.url
      );
    } else if (step.dmMessageToSend) {
      await senders.sendDirectMessage(
        accessToken,
        account.instagramId,
        userId,
        step.dmMessageToSend
      );
    }
  }
}
