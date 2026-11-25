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
import { providerManager } from "@/lib/providers/manager/provider-manager";
import { registerGiveawayEntry } from "./giveaway-engine";
import { claimCoupon } from "./coupon-engine";
import { matchFaq } from "./faq-engine";
import { matchKeywords } from "@/lib/utils/keyword-matcher";
import {
  validatePhone,
  validateEmail,
  savePhoneLeadDirectly,
  processLeadStep,
  buildMergedLeadCompletionText,
} from "./email-phone-collector";
import { checkHumanHandoverState, setHumanHandover } from "./human-handover";
import { generateSmartResponse } from "@/lib/ai/features/smart-responses";
import { executeFlowGraph, type FlowStepResult } from "@/lib/flow/flow-engine";
import type { FlowGraph } from "@/lib/flow/types";
import { addTagToLead, removeTagFromLead, getLeadTags } from "@/lib/crm/tags";
import { enrollUserInDrip, resumeExpiredDripEnrollmentsForUser } from "@/lib/drip/drip-engine";
import { getAccountOperatingSchedule, isWithinOperatingHours } from "@/lib/scheduling/operating-schedule";
import { extractPhoneNumber } from "@/lib/ai/phone-extractor";
import { normalizeLeadData, isValidHumanName } from "@/lib/ai/lead-normalizer";
import { syncLeadToWampCrm } from "./crm-sync";
import { selectDmMessageVariation } from "./ab-testing";
import {
  hasOpen24HourWindow,
  redactSensitiveFinancialData,
  classifyProviderError,
} from "@/lib/meta/compliance";

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

  const account = await prisma.instagramAccount.findUnique({
    where: { instagramId: instagramAccountId },
    include: { workspace: true },
  });

  if (!account) return;

  // Meta Compliance: Never process self-messages / echoes from the page itself
  if (
    !userId ||
    userId === "unknown" ||
    userId === account.instagramId ||
    (account.boxAccountId && userId === account.boxAccountId)
  ) {
    return;
  }

  const isBoxApiPrimary =
    account.orchestrationMode === "BOXAPI_PRIMARY" ||
    (Boolean(account.boxApiKey) && !account.accessToken);

  if (!account.accessToken && !isBoxApiPrimary) return;

  let accessToken = "";
  if (account.accessToken) {
    try {
      accessToken = safeDecryptToken(account.accessToken);
    } catch {
      if (!isBoxApiPrimary) return;
    }
  }

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
    safeSend(async () => {
      const { sanitized } = redactSensitiveFinancialData(msg);
      const res = await providerManager.sendTextMessage(account.id, uId, sanitized);
      if (!res.success) {
        const classified = classifyProviderError(res.error, instagramAccountId);
        throw classified || new Error(res.error || "Failed to send DM");
      }
      return res;
    });
  
  const sendDirectMessageWithLinkButton = (t: string, accId: string, uId: string, msg: string, lbl: string, url: string) => 
    safeSend(async () => {
      const { sanitized } = redactSensitiveFinancialData(msg);
      const res = await providerManager.sendTextMessage(account.id, uId, sanitized, {
        buttons: [{ type: "web_url", title: lbl, url }],
      });
      if (!res.success) {
        const classified = classifyProviderError(res.error, instagramAccountId);
        throw classified || new Error(res.error || "Failed to send DM with link button");
      }
      return res;
    });

  const sendDirectMediaMessage = (t: string, accId: string, uId: string, type: "image" | "video" | "audio", url: string) =>
    safeSend(async () => {
      const attType = type === "audio" ? "voice" : type;
      const res = await providerManager.sendAttachment(account.id, uId, attType, url);
      if (!res.success) {
        const classified = classifyProviderError(res.error, instagramAccountId);
        throw classified || new Error(res.error || "Failed to send media DM");
      }
      return res;
    });

  const sendDirectGenericTemplate = (t: string, accId: string, uId: string, elements: any[]) =>
    safeSend(async () => {
      const res = await providerManager.sendGenericTemplate(account.id, uId, elements);
      if (!res.success) {
        const classified = classifyProviderError(res.error, instagramAccountId);
        throw classified || new Error(res.error || "Failed to send generic template DM");
      }
      return res;
    });

  const sendDirectQuickReplies = (t: string, accId: string, uId: string, text: string, quickReplies: any[]) =>
    safeSend(async () => {
      const { sanitized } = redactSensitiveFinancialData(text);
      const res = await providerManager.sendTextMessage(account.id, uId, sanitized, {
        quick_replies: quickReplies.map((qr) => ({
          content_type: "text",
          title: qr.title,
          payload: qr.payload,
        })),
      });
      if (!res.success) {
        const classified = classifyProviderError(res.error, instagramAccountId);
        throw classified || new Error(res.error || "Failed to send quick replies DM");
      }
      return res;
    });

  const sendDirectMessageWithMultipleButtons = (t: string, accId: string, uId: string, text: string, buttons: any[]) =>
    safeSend(async () => {
      const { sanitized } = redactSensitiveFinancialData(text);
      const res = await providerManager.sendTextMessage(account.id, uId, sanitized, {
        buttons: buttons.map((b) => ({
          type: b.type === "web_url" ? "web_url" : "postback",
          title: b.title,
          url: b.url,
          payload: b.payload,
        })),
      });
      if (!res.success) {
        const classified = classifyProviderError(res.error, instagramAccountId);
        throw classified || new Error(res.error || "Failed to send multiple buttons DM");
      }
      return res;
    });

  const deliverMergedLeadCompletionMessage = async (params: {
    successMessage?: string | null;
    dmMessage?: string | null;
    linkButtonLabel?: string | null;
    trackedLinkUrl?: string | null;
  }) => {
    const mergedText = buildMergedLeadCompletionText({
      successMessage: params.successMessage,
      dmMessage: params.dmMessage,
    });

    if (params.trackedLinkUrl) {
      await sendDirectMessageWithLinkButton(
        accessToken,
        instagramAccountId,
        userId,
        mergedText,
        params.linkButtonLabel || "مشاهده و دریافت لینک",
        params.trackedLinkUrl
      );
    } else {
      await sendDirectMessage(accessToken, instagramAccountId, userId, mergedText);
    }
  };

  // ── 0. Update 24-Hour Messaging Window & Resume Paused Drips ────────────
  const conversationState = await prisma.conversationState.upsert({
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

  // ── 0.1 Check Operating Schedule ──────────────────────────────────────────
  const scheduleConfig = await getAccountOperatingSchedule(account.id);
  if (scheduleConfig) {
    const schedEval = isWithinOperatingHours(scheduleConfig);
    if (!schedEval.isInside) {
      if (schedEval.action === "SILENT") {
        console.log(`[DM Processor] Outside operating hours (SILENT). Skipping automated reply for user ${userId}.`);
        return;
      } else if (schedEval.action === "SEND_OFFLINE_MESSAGE") {
        const offlineMsg = schedEval.offlineMessage || "سلام! الان خارج از ساعت کاری هستیم، ولی پیامتون رو گرفتیم و خیلی زود جوابتون رو می‌دیم 🙏";
        await sendDirectMessage(accessToken, instagramAccountId, userId, offlineMsg);
        return;
      } else if (schedEval.action === "ESCALATE") {
        await setHumanHandover(account.workspaceId, account.instagramId, userId, true);
        if (schedEval.offlineMessage) {
          await sendDirectMessage(accessToken, instagramAccountId, userId, schedEval.offlineMessage);
        }
        return;
      }
    }
  }

  // ── 0.15 Ignore Empty / Attachment-only messages (e.g. template echoes from Instagram)
  if (!messageText && !quickReplyPayload) {
    return;
  }

  // ── 0.16 Check Pending Lead Confirmation (Optional Confirmation Step) ─────
  const rawMeta = (conversationState.metadata && typeof conversationState.metadata === "object")
    ? (conversationState.metadata as any)
    : {};
  const pendingConf = rawMeta.pendingConfirmation;

  if (pendingConf && conversationState.automationId) {
    const rawClean = (messageText || "").trim().toLowerCase();
    const isYes =
      quickReplyPayload === "CONFIRM_LEAD_YES" ||
      ["تایید", "تأیید", "بله", "درسته", "صحیحه", "درست است", "صحیح است", "ok", "yes", "y", "✅", "تایید شد"].some(
        (t) => rawClean === t || rawClean.startsWith(t)
      );

    const isEdit =
      quickReplyPayload === "CONFIRM_LEAD_EDIT" ||
      ["ویرایش", "خیر", "نه", "اشتباهه", "اشتباه است", "غلطه", "تغییر", "no", "edit", "✏️"].some(
        (t) => rawClean === t || rawClean.startsWith(t)
      );

    if (isEdit) {
      const updatedMeta = { ...rawMeta };
      delete updatedMeta.pendingConfirmation;
      await prisma.conversationState.update({
        where: { id: conversationState.id },
        data: { metadata: updatedMeta },
      });

      const editPrompt =
        pendingConf.type === "name"
          ? "باشه، لطفاً اسم و فامیل درستتون رو دوباره برام بفرستید 🙏"
          : "باشه، لطفاً شماره موبایل درستتون رو دوباره بفرستید (مثلاً 09123456789) 🙏";
      await sendDirectMessage(accessToken, instagramAccountId, userId, editPrompt);
      return;
    }

    if (isYes) {
      const confirmedValue = pendingConf.value;
      const updatedMeta = { ...rawMeta };
      delete updatedMeta.pendingConfirmation;

      const activeAutomation = await prisma.automation.findUnique({
        where: { id: conversationState.automationId },
        include: { trackedLinks: true },
      });

      const hasFlowGraph = Boolean(
        activeAutomation?.flowGraph &&
        typeof activeAutomation.flowGraph === "object" &&
        Array.isArray((activeAutomation.flowGraph as any).nodes) &&
        (activeAutomation.flowGraph as any).nodes.length > 0 &&
        (pendingConf.nodeId || conversationState.activeNodeId || conversationState.step === "FLOW_NODE")
      );

      if (activeAutomation && hasFlowGraph) {
        const graph = activeAutomation.flowGraph as unknown as FlowGraph;
        const currentNode = graph.nodes?.find(
          (n) => n.id === pendingConf.nodeId || n.id === conversationState.activeNodeId
        );
        const config = (currentNode?.data as any)?.config || {};

        if (pendingConf.type === "phone") {
          await prisma.conversationState.update({
            where: { id: conversationState.id },
            data: {
              extractedPhone: confirmedValue,
              phoneConfidence: 1.0,
              phoneOwner: "SELF",
              phoneRaw: confirmedValue,
              phoneBuffer: null,
              phoneBufferExpiresAt: null,
              conversationStatus: "LEAD_CAPTURED",
              metadata: updatedMeta,
            },
          });

          await prisma.lead.upsert({
            where: { id: `lead_${instagramAccountId}_${userId}` },
            create: {
              id: `lead_${instagramAccountId}_${userId}`,
              workspaceId: account.workspaceId,
              instagramAccountId,
              userId,
              username,
              phone: confirmedValue,
              phoneConfidence: 1.0,
              phoneOwner: "SELF",
              phoneRaw: confirmedValue,
              phoneVerified: true,
              provider: (account.primaryProvider || "META") as any,
              crmSyncStatus: "PENDING",
            },
            update: {
              phone: confirmedValue,
              phoneConfidence: 1.0,
              phoneOwner: "SELF",
              phoneRaw: confirmedValue,
              username: username ?? undefined,
              provider: (account.primaryProvider || "META") as any,
            },
          });

          const leadRecord = await prisma.lead.findUnique({
            where: { id: `lead_${instagramAccountId}_${userId}` },
          });
          const rawLeadName = leadRecord?.name || (conversationState.metadata as any)?.name;
          const leadFullName = isValidHumanName(rawLeadName) ? String(rawLeadName).trim() : undefined;

          void syncLeadToWampCrm({
            leadId: `lead_${instagramAccountId}_${userId}`,
            phone: confirmedValue,
            full_name: leadFullName,
            username,
            igsid: userId,
            instagramAccountId,
            provider: (account.primaryProvider || "META") as any,
            lead_source: "openreply-confirmed-flow",
            auto_verify_and_book: Boolean(config.autoVerifyAndBook || activeAutomation.autoVerifyAndBook),
          });

          if (config.requireOtp) {
            const leadResult = await processLeadStep({
              workspaceId: account.workspaceId,
              instagramAccountId,
              userId,
              username,
              userMessage: confirmedValue,
              currentStep: "AWAITING_PHONE",
              automationId: activeAutomation.id,
              provider: (account.primaryProvider || "META") as any,
              requireOtp: true,
            });

            if (leadResult.replyMessage) {
              await sendDirectMessage(accessToken, instagramAccountId, userId, leadResult.replyMessage);
            }
            return;
          }

          const nextEdge = graph.edges?.find((e) => e.sourceNodeId === currentNode?.id);
          if (nextEdge?.targetNodeId) {
            await prisma.conversationState.update({
              where: { id: conversationState.id },
              data: { activeNodeId: nextEdge.targetNodeId },
            });

            const userTags = await getLeadTags(account.workspaceId, userId);
            const graphResults = await executeFlowGraph(
              graph,
              {
                workspaceId: account.workspaceId,
                instagramAccountId: account.instagramId,
                userId,
                username,
                userMessage: messageText,
                userTags,
              },
              nextEdge.targetNodeId
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
          } else {
            const successMsg =
              config.successMessage ||
              activeAutomation.leadSuccessMessage ||
              "عالیه! شماره‌تون با موفقیت ثبت شد، خیلی زود باهاتون تماس می‌گیریم 🙏";
            await prisma.conversationState.update({
              where: { id: conversationState.id },
              data: { step: "COMPLETED" },
            });
            await deliverMergedLeadCompletionMessage({
              successMessage: successMsg,
              dmMessage: activeAutomation?.dmMessage,
              linkButtonLabel: activeAutomation?.linkButtonLabel,
              trackedLinkUrl: activeAutomation?.trackedLinks?.[0]?.destinationUrl,
            });
            return;
          }
        } else if (pendingConf.type === "name" || pendingConf.type === "text") {
          await prisma.conversationState.update({
            where: { id: conversationState.id },
            data: { metadata: updatedMeta },
          });

          await prisma.lead.upsert({
            where: { id: `lead_${instagramAccountId}_${userId}` },
            create: {
              id: `lead_${instagramAccountId}_${userId}`,
              workspaceId: account.workspaceId,
              instagramAccountId,
              userId,
              username,
              name: confirmedValue,
              provider: (account.primaryProvider || "META") as any,
              crmSyncStatus: "PENDING",
            },
            update: {
              name: confirmedValue,
              username: username ?? undefined,
            },
          });

          void syncLeadToWampCrm({
            leadId: `lead_${instagramAccountId}_${userId}`,
            full_name: confirmedValue,
            username,
            igsid: userId,
            instagramAccountId,
            provider: (account.primaryProvider || "META") as any,
            lead_source: "openreply-confirmed-flow-name",
            auto_verify_and_book: Boolean(config.autoVerifyAndBook || activeAutomation.autoVerifyAndBook),
          });

          const nextEdge = graph.edges?.find((e) => e.sourceNodeId === currentNode?.id);
          if (nextEdge?.targetNodeId) {
            await prisma.conversationState.update({
              where: { id: conversationState.id },
              data: { activeNodeId: nextEdge.targetNodeId },
            });

            const userTags = await getLeadTags(account.workspaceId, userId);
            const graphResults = await executeFlowGraph(
              graph,
              {
                workspaceId: account.workspaceId,
                instagramAccountId: account.instagramId,
                userId,
                username,
                userMessage: messageText,
                userTags,
              },
              nextEdge.targetNodeId
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
          } else {
            const successMsg =
              config.successMessage || "عالیه! اطلاعاتتون با موفقیت ثبت شد، ممنون از شما 🙏";
            await prisma.conversationState.update({
              where: { id: conversationState.id },
              data: { step: "COMPLETED" },
            });
            await sendDirectMessage(accessToken, instagramAccountId, userId, successMsg);
            return;
          }
        }
      } else if (activeAutomation) {
        // Standard Campaign confirmation (without Flow Graph)
        if (pendingConf.type === "phone") {
          const leadRecord = await prisma.lead.findUnique({
            where: { id: `lead_${instagramAccountId}_${userId}` },
          });

          const rawLeadName = leadRecord?.name || (conversationState.metadata as any)?.name;
          const validLeadName = isValidHumanName(rawLeadName) ? String(rawLeadName).trim() : undefined;

          await prisma.lead.upsert({
            where: { id: `lead_${instagramAccountId}_${userId}` },
            create: {
              id: `lead_${instagramAccountId}_${userId}`,
              workspaceId: account.workspaceId,
              instagramAccountId,
              userId,
              username,
              phone: confirmedValue,
              phoneConfidence: 1.0,
              phoneOwner: "SELF",
              phoneRaw: confirmedValue,
              phoneVerified: true,
              provider: (account.primaryProvider || "META") as any,
              crmSyncStatus: "PENDING",
            },
            update: {
              phone: confirmedValue,
              phoneConfidence: 1.0,
              phoneOwner: "SELF",
              phoneRaw: confirmedValue,
              username: username ?? undefined,
              provider: (account.primaryProvider || "META") as any,
              phoneVerified: true,
            },
          });

          // If the campaign requires collecting Name and we don't have a valid name yet, ask for Name next!
          if (activeAutomation.collectName && !validLeadName) {
            await prisma.conversationState.update({
              where: { id: conversationState.id },
              data: {
                step: "AWAITING_NAME",
                extractedPhone: confirmedValue,
                phoneConfidence: 1.0,
                phoneOwner: "SELF",
                phoneRaw: confirmedValue,
                phoneBuffer: null,
                phoneBufferExpiresAt: null,
                conversationStatus: "LEAD_CAPTURED",
                metadata: updatedMeta,
              },
            });

            void syncLeadToWampCrm({
              leadId: `lead_${instagramAccountId}_${userId}`,
              phone: confirmedValue,
              username,
              igsid: userId,
              instagramAccountId,
              provider: (account.primaryProvider || "META") as any,
              lead_source: `campaign:${activeAutomation.name || activeAutomation.id}`,
              auto_verify_and_book: Boolean(activeAutomation.autoVerifyAndBook),
            });

            await sendDirectMessage(
              accessToken,
              instagramAccountId,
              userId,
              activeAutomation.leadPromptName ||
                "عالیه! شماره‌تون ثبت شد 👍 فقط لطفاً اسم و فامیلتون رو هم بفرستید تا تکمیل بشه 🙏"
            );
            return;
          }

          await prisma.conversationState.update({
            where: { id: conversationState.id },
            data: {
              step: "COMPLETED",
              extractedPhone: confirmedValue,
              phoneConfidence: 1.0,
              phoneOwner: "SELF",
              phoneRaw: confirmedValue,
              phoneBuffer: null,
              phoneBufferExpiresAt: null,
              conversationStatus: "LEAD_CAPTURED",
              metadata: updatedMeta,
            },
          });

          void syncLeadToWampCrm({
            leadId: `lead_${instagramAccountId}_${userId}`,
            phone: confirmedValue,
            full_name: validLeadName,
            username,
            igsid: userId,
            instagramAccountId,
            provider: (account.primaryProvider || "META") as any,
            lead_source: `campaign:${activeAutomation.name || activeAutomation.id}`,
            auto_verify_and_book: Boolean(activeAutomation.autoVerifyAndBook),
          });

          const successMsg =
            activeAutomation.leadSuccessMessage ||
            "عالیه! شماره‌تون با موفقیت ثبت شد، خیلی زود باهاتون تماس می‌گیریم 🙏";
          await deliverMergedLeadCompletionMessage({
            successMessage: successMsg,
            dmMessage: activeAutomation.dmMessage,
            linkButtonLabel: activeAutomation.linkButtonLabel,
            trackedLinkUrl: activeAutomation.trackedLinks?.[0]?.destinationUrl,
          });
          return;
        }
      }
    }
  }

  // ── 0.2 Intelligent Phone Extraction & CRM Ingestion ──────────────────────
  const isBufferValid = conversationState.phoneBufferExpiresAt
    ? conversationState.phoneBufferExpiresAt.getTime() > Date.now()
    : false;

  const phoneRes = extractPhoneNumber({
    messageText,
    previousBuffer: isBufferValid ? conversationState.phoneBuffer : null,
    bufferAgeMs: isBufferValid && conversationState.phoneBufferExpiresAt
      ? Date.now() - (conversationState.phoneBufferExpiresAt.getTime() - 180000)
      : 0,
  });

  if (phoneRes.detected && phoneRes.phoneNumber) {
    console.log(`[DM Processor] Phone detected for user ${userId}: ${phoneRes.phoneNumber} (Confidence: ${phoneRes.confidence})`);

    await prisma.conversationState.update({
      where: { id: conversationState.id },
      data: {
        extractedPhone: phoneRes.phoneNumber,
        phoneConfidence: phoneRes.confidence,
        phoneOwner: phoneRes.owner,
        phoneRaw: phoneRes.rawInput || messageText,
        phoneBuffer: null,
        phoneBufferExpiresAt: null,
        conversationStatus: "LEAD_CAPTURED",
      },
    });

    // Extract any co-occurring name or customer notes silently
    const norm = await normalizeLeadData({
      workspaceId: account.workspaceId,
      userMessage: messageText,
      expectedField: conversationState.step === "AWAITING_NAME" ? "both" : "phone",
      mode: "SILENT_NORMALIZE_ONLY",
    });

    await prisma.lead.upsert({
      where: { id: `lead_${instagramAccountId}_${userId}` },
      create: {
        id: `lead_${instagramAccountId}_${userId}`,
        workspaceId: account.workspaceId,
        instagramAccountId,
        userId,
        username,
        name: norm.fullName || undefined,
        phone: phoneRes.phoneNumber,
        phoneNotes: norm.notes || undefined,
        phoneConfidence: phoneRes.confidence,
        phoneOwner: phoneRes.owner,
        phoneRaw: phoneRes.rawInput || messageText,
        phoneVerified: phoneRes.confidence >= 0.9,
        provider: (account.primaryProvider || "META") as any,
        crmSyncStatus: "PENDING",
      },
      update: {
        phone: phoneRes.phoneNumber,
        name: norm.fullName || undefined,
        phoneNotes: norm.notes || undefined,
        phoneConfidence: phoneRes.confidence,
        phoneOwner: phoneRes.owner,
        phoneRaw: phoneRes.rawInput || messageText,
        username: username ?? undefined,
        provider: (account.primaryProvider || "META") as any,
      },
    });

    const activeAutomation = conversationState.automationId
      ? await prisma.automation.findUnique({
          where: { id: conversationState.automationId },
          include: { trackedLinks: true },
        })
      : null;

    const existingLead = await prisma.lead.findUnique({
      where: { id: `lead_${instagramAccountId}_${userId}` },
    });
    const rawExistingName = existingLead?.name || (conversationState.metadata as any)?.name;
    const validExistingName = isValidHumanName(rawExistingName) ? String(rawExistingName).trim() : undefined;
    const validNormName = isValidHumanName(norm.fullName) ? norm.fullName!.trim() : undefined;
    const leadFullName = validExistingName || validNormName || undefined;

    const isFlowActive = Boolean(
      activeAutomation &&
      activeAutomation.flowGraph &&
      typeof activeAutomation.flowGraph === "object" &&
      (conversationState.activeNodeId || conversationState.step === "FLOW_NODE")
    );

    let currentNode: any = null;
    let nodeConfig: any = {};
    if (isFlowActive && activeAutomation?.flowGraph) {
      const graph = activeAutomation.flowGraph as unknown as FlowGraph;
      currentNode = graph.nodes?.find((n) => n.id === conversationState.activeNodeId);
      nodeConfig = (currentNode?.data as any)?.config || {};
    }

    const shouldConfirm = isFlowActive
      ? Boolean(nodeConfig.confirmBeforeSave ?? activeAutomation?.confirmBeforeSave)
      : Boolean(activeAutomation?.confirmBeforeSave);

    // ── Check if confirmation step is requested before finalizing lead ────────
    if (shouldConfirm) {
      const existingMeta =
        conversationState.metadata && typeof conversationState.metadata === "object"
          ? (conversationState.metadata as any)
          : {};
      await prisma.conversationState.update({
        where: { id: conversationState.id },
        data: {
          metadata: {
            ...existingMeta,
            pendingConfirmation: {
              type: "phone",
              value: phoneRes.phoneNumber,
              nodeId: currentNode?.id,
              automationId: activeAutomation?.id,
            },
          },
        },
      });

      const template =
        nodeConfig.confirmMessage ||
        activeAutomation?.confirmMessage ||
        "شماره‌تون {phone} ثبت شد، درسته؟";
      const confirmMsg = template
        .replace(/{value}/g, phoneRes.phoneNumber)
        .replace(/{phone}/g, phoneRes.phoneNumber);

      await sendDirectQuickReplies(
        accessToken,
        instagramAccountId,
        userId,
        confirmMsg,
        [
          { content_type: "text", title: "✅ تایید", payload: "CONFIRM_LEAD_YES" },
          { content_type: "text", title: "✏️ ویرایش", payload: "CONFIRM_LEAD_EDIT" },
        ]
      );
      return;
    }

    // Immediate background sync to WAMP Booking CRM (when confirmation is not pending)
    void syncLeadToWampCrm({
      leadId: `lead_${instagramAccountId}_${userId}`,
      phone: phoneRes.phoneNumber,
      full_name: leadFullName,
      username,
      igsid: userId,
      instagramAccountId,
      provider: (account.primaryProvider || "META") as any,
      lead_source: activeAutomation ? `campaign:${activeAutomation.name || activeAutomation.id}` : "openreply-ai-extraction",
      auto_verify_and_book: Boolean(nodeConfig.autoVerifyAndBook || activeAutomation?.autoVerifyAndBook),
      custom_data: {
        confidence: phoneRes.confidence,
        owner: phoneRes.owner,
        is_correction: phoneRes.isCorrection,
        lead_notes: norm.notes || undefined,
      },
    });

    // If conversation is at a FLOW_NODE for collect_input
    if (isFlowActive && activeAutomation && activeAutomation.flowGraph) {
      const graph = activeAutomation.flowGraph as unknown as FlowGraph;

      if (currentNode?.type === "collect_input") {
        const config = nodeConfig;

        // Check if OTP verification is requested
        if (config.requireOtp) {
          const leadResult = await processLeadStep({
            workspaceId: account.workspaceId,
            instagramAccountId,
            userId,
            username,
            userMessage: phoneRes.phoneNumber,
            currentStep: "AWAITING_PHONE",
            automationId: activeAutomation.id,
            provider: (account.primaryProvider || "META") as any,
            requireOtp: true,
          });

          if (leadResult.replyMessage) {
            await sendDirectMessage(accessToken, instagramAccountId, userId, leadResult.replyMessage);
          }
          return;
        }

        // Advance to the next node in the flow, or complete if end of flow
        const nextEdge = graph.edges?.find((e) => e.sourceNodeId === currentNode.id);
        if (nextEdge?.targetNodeId) {
          await prisma.conversationState.update({
            where: { id: conversationState.id },
            data: { activeNodeId: nextEdge.targetNodeId },
          });

          const userTags = await getLeadTags(account.workspaceId, userId);
          const graphResults = await executeFlowGraph(
            graph,
            {
              workspaceId: account.workspaceId,
              instagramAccountId: account.instagramId,
              userId,
              username,
              userMessage: messageText,
              userTags,
            },
            nextEdge.targetNodeId
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
        } else {
          // End of flow: send merged success + link message and complete
          const successMsg =
            config.successMessage ||
            activeAutomation.leadSuccessMessage ||
            "عالیه! شماره‌تون با موفقیت ثبت شد، خیلی زود باهاتون تماس می‌گیریم 🙏";
          await prisma.conversationState.update({
            where: { id: conversationState.id },
            data: { step: "COMPLETED" },
          });
          await deliverMergedLeadCompletionMessage({
            successMessage: successMsg,
            dmMessage: activeAutomation.dmMessage,
            linkButtonLabel: activeAutomation.linkButtonLabel,
            trackedLinkUrl: activeAutomation.trackedLinks?.[0]?.destinationUrl,
          });
          return;
        }
      }
    }

    // If conversation was awaiting name/phone in a linear campaign
    const convMeta =
      conversationState.metadata && typeof conversationState.metadata === "object"
        ? (conversationState.metadata as Record<string, unknown>)
        : {};
    const hasNameInCurrentForm = Boolean(validNormName || convMeta.nameCapturedInCurrentForm === true);

    if (conversationState.step === "AWAITING_NAME" && activeAutomation?.collectName && !hasNameInCurrentForm) {
      await prisma.conversationState.update({
        where: { id: conversationState.id },
        data: {
          step: "AWAITING_NAME",
          metadata: { ...convMeta, phoneCapturedInCurrentForm: true },
        },
      });
      await sendDirectMessage(
        accessToken,
        instagramAccountId,
        userId,
        activeAutomation.leadPromptName ||
          "مرسی، شماره‌تون رو گرفتم 👍 لطفاً اسم و فامیلتون رو هم برام بنویسید تا تکمیل بشه 🙏"
      );
      return;
    }

    if (conversationState.step === "AWAITING_PHONE" || (conversationState.step === "AWAITING_NAME" && hasNameInCurrentForm)) {
      const needsOtp = Boolean(
        activeAutomation?.collectPhone &&
        !activeAutomation?.collectPhoneSkipOtp &&
        !activeAutomation?.autoVerifyAndBook
      );

      if (needsOtp) {
        const leadResult = await processLeadStep({
          workspaceId: account.workspaceId,
          instagramAccountId,
          userId,
          username,
          userMessage: phoneRes.phoneNumber,
          currentStep: "AWAITING_PHONE",
          automationId: activeAutomation?.id,
          provider: (account.primaryProvider || "META") as any,
          requireOtp: true,
        });

        if (leadResult.replyMessage) {
          await sendDirectMessage(accessToken, instagramAccountId, userId, leadResult.replyMessage);
        }
        return;
      }

      const successMsg =
        activeAutomation?.leadSuccessMessage ||
        "عالیه! شماره‌تون با موفقیت ثبت شد، خیلی زود باهاتون تماس می‌گیریم 🙏";
      await prisma.conversationState.update({
        where: { id: conversationState.id },
        data: { step: "COMPLETED" },
      });
      await deliverMergedLeadCompletionMessage({
        successMessage: successMsg,
        dmMessage: activeAutomation?.dmMessage,
        linkButtonLabel: activeAutomation?.linkButtonLabel,
        trackedLinkUrl: activeAutomation?.trackedLinks?.[0]?.destinationUrl,
      });
      return;
    }
  } else if (phoneRes.isPartial && phoneRes.partialBuffer) {
    await prisma.conversationState.update({
      where: { id: conversationState.id },
      data: {
        phoneBuffer: phoneRes.partialBuffer,
        phoneBufferExpiresAt: new Date(Date.now() + 3 * 60 * 1000), // 3 min window
      },
    });
  }

  // ── 1. Human Handover Check ──────────────────────────────────────────────
  const handoverState = await checkHumanHandoverState(
    account.workspaceId,
    instagramAccountId,
    userId,
    messageText,
    conversationState
  );
  if (handoverState.isHandover) {
    console.log(
      `[DM Processor] Human handover active for user ${userId}. Skipping automation. Reason: ${handoverState.reason}`
    );
    return;
  }

  // ── 2. Active Flow or Lead Collection State ──────────────────────────────

  // Check lead prompt step
  if (
    conversationState &&
    (conversationState.step === "AWAITING_NAME" ||
      conversationState.step === "AWAITING_EMAIL" ||
      conversationState.step === "AWAITING_PHONE" ||
      conversationState.step === "AWAITING_OTP")
  ) {
    const leadResult = await processLeadStep({
      workspaceId: account.workspaceId,
      instagramAccountId,
      userId,
      username,
      userMessage: messageText,
      currentStep: conversationState.step as any,
      automationId: conversationState.automationId ?? undefined,
      provider: (account.primaryProvider || "META") as any,
    });

    // Deliver the campaign's completion message + promised link/content merged into 1 bubble
    if (leadResult.nextStep === "COMPLETED" && conversationState.automationId) {
      const doneAutomation = await prisma.automation.findUnique({
        where: { id: conversationState.automationId },
        include: { trackedLinks: true },
      });
      await deliverMergedLeadCompletionMessage({
        successMessage: leadResult.replyMessage,
        dmMessage: doneAutomation?.dmMessage,
        linkButtonLabel: doneAutomation?.linkButtonLabel,
        trackedLinkUrl: doneAutomation?.trackedLinks?.[0]?.destinationUrl,
      });
    } else if (leadResult.replyMessage) {
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
      const graph = activeAutomation.flowGraph as unknown as FlowGraph;
      const currentNode = graph.nodes?.find((n) => n.id === conversationState.activeNodeId);

      // If waiting at collect_input node for phone and phone was not detected
      if (currentNode?.type === "collect_input") {
        const config = (currentNode.data as any)?.config || {};
        const inputType = config.inputType || "phone";

        if (inputType === "phone") {
          // AI Silent Normalizer with Fast-Path (0 tokens if clean phone, resilient to sentences/questions)
          const norm = await normalizeLeadData({
            workspaceId: account.workspaceId,
            userMessage: messageText,
            expectedField: "phone",
            mode: "SILENT_NORMALIZE_ONLY",
          });

          if (!norm.phone) {
            const baseValidationMsg =
              config.validationErrorMessage ||
              "شماره موبایل درست نیست؛ لطفاً شماره‌تون رو کامل بفرستید (مثلاً 09123456789) 🙏";
            const validationMsg = norm.replyMessageToUser
              ? `${norm.replyMessageToUser}\n\n${baseValidationMsg}`
              : baseValidationMsg;
            await sendDirectMessage(accessToken, instagramAccountId, userId, validationMsg);
            return;
          }

          const cleanPhone = norm.phone;

          // If confirmation step is enabled, ask for confirmation with clean phone!
          if (config.confirmBeforeSave) {
            const existingMeta =
              conversationState.metadata && typeof conversationState.metadata === "object"
                ? (conversationState.metadata as any)
                : {};
            await prisma.conversationState.update({
              where: { id: conversationState.id },
              data: {
                metadata: {
                  ...existingMeta,
                  pendingConfirmation: {
                    type: "phone",
                    value: cleanPhone,
                    nodeId: currentNode.id,
                  },
                },
              },
            });

            const template =
              config.confirmMessage ||
              "شماره‌تون «{phone}» ثبت شد، درسته؟";
            const confirmMsg = template
              .replace(/{value}/g, cleanPhone)
              .replace(/{phone}/g, cleanPhone);

            await sendDirectQuickReplies(
              accessToken,
              instagramAccountId,
              userId,
              confirmMsg,
              [
                { content_type: "text", title: "✅ تایید", payload: "CONFIRM_LEAD_YES" },
                { content_type: "text", title: "✏️ ویرایش", payload: "CONFIRM_LEAD_EDIT" },
              ]
            );
            return;
          }

          await prisma.lead.upsert({
            where: { id: `lead_${instagramAccountId}_${userId}` },
            create: {
              id: `lead_${instagramAccountId}_${userId}`,
              workspaceId: account.workspaceId,
              instagramAccountId,
              userId,
              username,
              name: norm.fullName || undefined,
              phone: cleanPhone,
              phoneNotes: norm.notes || undefined,
              provider: (account.primaryProvider || "META") as any,
              phoneVerified: true,
              crmSyncStatus: "PENDING",
            },
            update: {
              phone: cleanPhone,
              name: norm.fullName || undefined,
              phoneNotes: norm.notes || undefined,
              username: username ?? undefined,
              phoneVerified: true,
            },
          });

          void syncLeadToWampCrm({
            leadId: `lead_${instagramAccountId}_${userId}`,
            phone: cleanPhone,
            full_name: norm.fullName || undefined,
            username,
            igsid: userId,
            instagramAccountId,
            provider: (account.primaryProvider || "META") as any,
            lead_source: "openreply-flow-phone",
            auto_verify_and_book: Boolean(config.autoVerifyAndBook || activeAutomation.autoVerifyAndBook),
            custom_data: norm.notes ? { lead_notes: norm.notes } : undefined,
          });

          const nextEdge = graph.edges?.find((e) => e.sourceNodeId === currentNode.id);
          if (nextEdge?.targetNodeId) {
            await prisma.conversationState.update({
              where: { id: conversationState.id },
              data: { activeNodeId: nextEdge.targetNodeId },
            });

            const userTags = await getLeadTags(account.workspaceId, userId);
            const graphResults = await executeFlowGraph(
              graph,
              {
                workspaceId: account.workspaceId,
                instagramAccountId: account.instagramId,
                accountId: account.id,
                automationId: activeAutomation.id,
                userId,
                username,
                userMessage: messageText,
                userTags,
              },
              nextEdge.targetNodeId
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
          } else {
            const successMsg =
              config.successMessage ||
              activeAutomation.leadSuccessMessage ||
              "عالیه! شماره‌تون با موفقیت ثبت شد، خیلی زود باهاتون تماس می‌گیریم 🙏";
            await prisma.conversationState.update({
              where: { id: conversationState.id },
              data: { step: "COMPLETED" },
            });
            await sendDirectMessage(accessToken, instagramAccountId, userId, successMsg);
            return;
          }
        } else if (inputType === "email") {
          const emailClean = messageText.trim().toLowerCase();
          if (!validateEmail(emailClean)) {
            const validationMsg =
              config.validationErrorMessage ||
              "ایمیل معتبر نیست؛ لطفاً یه ایمیل درست بفرستید (مثلاً name@example.com) 🙏";
            await sendDirectMessage(accessToken, instagramAccountId, userId, validationMsg);
            return;
          }

          await prisma.lead.upsert({
            where: { id: `lead_${instagramAccountId}_${userId}` },
            create: {
              id: `lead_${instagramAccountId}_${userId}`,
              workspaceId: account.workspaceId,
              instagramAccountId,
              userId,
              username,
              email: emailClean,
              provider: (account.primaryProvider || "META") as any,
              crmSyncStatus: "PENDING",
            },
            update: {
              email: emailClean,
              username: username ?? undefined,
            },
          });

          void syncLeadToWampCrm({
            leadId: `lead_${instagramAccountId}_${userId}`,
            email: emailClean,
            username,
            igsid: userId,
            instagramAccountId,
            provider: (account.primaryProvider || "META") as any,
            lead_source: "openreply-flow-email",
            auto_verify_and_book: Boolean(config.autoVerifyAndBook || activeAutomation.autoVerifyAndBook),
          });

          const nextEdge = graph.edges?.find((e) => e.sourceNodeId === currentNode.id);
          if (nextEdge?.targetNodeId) {
            await prisma.conversationState.update({
              where: { id: conversationState.id },
              data: { activeNodeId: nextEdge.targetNodeId },
            });

            const userTags = await getLeadTags(account.workspaceId, userId);
            const graphResults = await executeFlowGraph(
              graph,
              {
                workspaceId: account.workspaceId,
                instagramAccountId: account.instagramId,
                accountId: account.id,
                automationId: activeAutomation.id,
                userId,
                username,
                userMessage: messageText,
                userTags,
              },
              nextEdge.targetNodeId
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
          } else {
            const successMsg = config.successMessage || "ایمیلتون با موفقیت ثبت شد! ممنون از شما 🙏";
            await prisma.conversationState.update({
              where: { id: conversationState.id },
              data: { step: "COMPLETED" },
            });
            await sendDirectMessage(accessToken, instagramAccountId, userId, successMsg);
            return;
          }
        } else if (inputType === "name" || inputType === "text") {
          const isNameField = inputType === "name";
          let cleanValue = messageText.trim();
          let normPhone: string | null = null;
          let normNotes: string | null = null;

          if (isNameField) {
            const norm = await normalizeLeadData({
              workspaceId: account.workspaceId,
              userMessage: messageText,
              expectedField: "name",
              mode: "SILENT_NORMALIZE_ONLY",
            });
            cleanValue = isValidHumanName(norm.fullName) ? norm.fullName!.trim() : "";
            normPhone = norm.phone;
            normNotes = norm.notes;

            if (!cleanValue) {
              const askAgain =
                norm.replyMessageToUser
                  ? `${norm.replyMessageToUser}\n\nلطفاً اسم و فامیل واقعیتون رو برام بنویسید 🙏`
                  : "لطفاً اسم و فامیل واقعیتون رو برام بنویسید 🙏";
              await sendDirectMessage(accessToken, instagramAccountId, userId, askAgain);
              return;
            }
          } else {
            normNotes = cleanValue;
          }
          const cleanName = cleanValue;

          // If confirmation step is enabled, ask for confirmation BEFORE saving to CRM
          if (config.confirmBeforeSave) {
            const existingMeta =
              conversationState.metadata && typeof conversationState.metadata === "object"
                ? (conversationState.metadata as any)
                : {};
            await prisma.conversationState.update({
              where: { id: conversationState.id },
              data: {
                metadata: {
                  ...existingMeta,
                  pendingConfirmation: {
                    type: "name",
                    value: cleanName,
                    nodeId: currentNode.id,
                  },
                },
              },
            });

            const template =
              config.confirmMessage ||
              "اسم و فامیلتون «{value}» ثبت شد، درسته؟";
            const confirmMsg = template
              .replace(/{value}/g, cleanName)
              .replace(/{name}/g, cleanName);

            await sendDirectQuickReplies(
              accessToken,
              instagramAccountId,
              userId,
              confirmMsg,
              [
                { content_type: "text", title: "✅ تایید", payload: "CONFIRM_LEAD_YES" },
                { content_type: "text", title: "✏️ ویرایش", payload: "CONFIRM_LEAD_EDIT" },
              ]
            );
            return;
          }

          await prisma.lead.upsert({
            where: { id: `lead_${instagramAccountId}_${userId}` },
            create: {
              id: `lead_${instagramAccountId}_${userId}`,
              workspaceId: account.workspaceId,
              instagramAccountId,
              userId,
              username,
              name: isNameField ? cleanName : undefined,
              phone: normPhone || undefined,
              phoneNotes: normNotes || undefined,
              provider: (account.primaryProvider || "META") as any,
              crmSyncStatus: "PENDING",
            },
            update: {
              ...(isNameField ? { name: cleanName } : {}),
              phone: normPhone || undefined,
              phoneNotes: normNotes || undefined,
              username: username ?? undefined,
            },
          });

          void syncLeadToWampCrm({
            leadId: `lead_${instagramAccountId}_${userId}`,
            full_name: isNameField ? cleanName : undefined,
            phone: normPhone || undefined,
            username,
            igsid: userId,
            instagramAccountId,
            provider: (account.primaryProvider || "META") as any,
            lead_source: isNameField ? "openreply-flow-name" : "openreply-flow-text",
            custom_data: normNotes ? { lead_notes: normNotes } : undefined,
          });

          const nextEdge = graph.edges?.find((e) => e.sourceNodeId === currentNode.id);
          if (nextEdge?.targetNodeId) {
            await prisma.conversationState.update({
              where: { id: conversationState.id },
              data: { activeNodeId: nextEdge.targetNodeId },
            });

            const userTags = await getLeadTags(account.workspaceId, userId);
            const graphResults = await executeFlowGraph(
              graph,
              {
                workspaceId: account.workspaceId,
                instagramAccountId: account.instagramId,
                userId,
                username,
                userMessage: messageText,
                userTags,
              },
              nextEdge.targetNodeId
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
          } else {
            const successMsg = config.successMessage || "عالیه! اطلاعاتتون با موفقیت ثبت شد، ممنون از شما 🙏";
            await prisma.conversationState.update({
              where: { id: conversationState.id },
              data: { step: "COMPLETED" },
            });
            await sendDirectMessage(accessToken, instagramAccountId, userId, successMsg);
            return;
          }
        }
      }

      const userTags = await getLeadTags(account.workspaceId, userId);
      const graphResults = await executeFlowGraph(
        graph,
        {
          workspaceId: account.workspaceId,
          instagramAccountId: account.instagramId,
          accountId: account.id,
          automationId: activeAutomation.id,
          userId,
          username,
          userMessage: messageText,
          userTags,
          selectedQuickReplyPayload: quickReplyPayload || messageText,
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
        },
        messageText
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
        in: [triggerType, "FAQ", "GIVEAWAY", "LEAD_MAGNET", "COUPON", "WELCOME", "DIRECT_MESSAGE", "COMMENT"],
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
    const isFlowAllTrigger =
      (automation.flowGraph as any)?.nodes?.some(
        (n: any) => n.type === "trigger" && n.data?.config?.triggerType === "ALL"
      );

    const isTriggerMatch =
      isFlowAllTrigger ||
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
            accountId: account.id,
            automationId: automation.id,
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
          },
          messageText
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

      // ── D. Name / Email / Phone Collection Prompting ────────────────────────────
      if (automation.collectName || automation.collectEmail || automation.collectPhone) {
        if (!automation.collectName && automation.collectPhone && automation.collectPhoneSkipOtp && validatePhone(messageText)) {
          await savePhoneLeadDirectly({
            phone: messageText,
            username,
            igsid: userId,
            workspaceId: account.workspaceId,
            instagramAccountId,
            automationId: automation.id,
          });

          await deliverMergedLeadCompletionMessage({
            successMessage: automation.leadSuccessMessage || "عالیه! اطلاعاتتون با موفقیت ثبت شد 🙏",
            dmMessage: automation.dmMessage,
            linkButtonLabel: automation.linkButtonLabel,
            trackedLinkUrl: automation.trackedLinks?.[0]?.destinationUrl,
          });
          return;
        }

        const isSingleStep = Boolean(
          automation.collectName && automation.collectPhone && automation.singleStepLeadCapture
        );
        const initialStep = automation.collectName
          ? "AWAITING_NAME"
          : automation.collectEmail
          ? "AWAITING_EMAIL"
          : "AWAITING_PHONE";
        const initialMetadata = isSingleStep ? { singleStepLead: true } : {};

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
            activeNodeId: null,
            metadata: initialMetadata,
          },
          update: {
            step: initialStep,
            automationId: automation.id,
            activeNodeId: null,
            metadata: initialMetadata,
          },
        });

        const promptText = selectDmMessageVariation(
          isSingleStep
            ? automation.leadPromptBoth ||
                "سلام! برای تکمیل سریع، لطفاً اسم و فامیل به همراه شماره موبایلتون رو توی یک پیام برام بفرستید 🙏"
            : initialStep === "AWAITING_NAME"
            ? automation.leadPromptName || "سلام! لطفاً اسم و فامیلتون رو برام بنویسید 🙏"
            : initialStep === "AWAITING_EMAIL"
            ? automation.leadPromptEmail || "لطفاً ایمیلتون رو بفرستید:"
            : automation.leadPromptPhone || "لطفاً شماره موبایلتون رو بفرستید 📱"
        );

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
  senders: DmSenderHelpers,
  lastUserMessage?: string
) {
  for (const step of graphResults) {
    // 1. Handle CRM Tag Actions
    if (step.tagAction && step.tagAction.tagName?.trim()) {
      if (step.tagAction.action === "add") {
        await addTagToLead(account.workspaceId, account.instagramId, userId, step.tagAction.tagName.trim());
      } else {
        await removeTagFromLead(account.workspaceId, userId, step.tagAction.tagName.trim());
      }
    }

    if (step.enrollDripCampaignId && step.enrollDripCampaignId.trim()) {
      await enrollUserInDrip({
        workspaceId: account.workspaceId,
        instagramAccountId: account.instagramId,
        userId,
        campaignId: step.enrollDripCampaignId.trim(),
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

    // Handle Smart Delay scheduling for remaining branch
    if (step.nodeType === "smart_delay" && step.nextStepNodeId && (step.delayMs || step.delayMinutes)) {
      const delayMs = step.delayMs || (step.delayMinutes || 5) * 60_000;
      await enqueueJob(
        "resume-flow-node",
        {
          instagramAccountId: account.instagramId,
          userId,
          username,
          automationId: automation.id,
          startNodeId: step.nextStepNodeId,
        },
        delayMs
      );
      continue;
    }

    // Handle AI Reply Node safely (never leak errors to user)
    if (step.isAiReply) {
      try {
        const smartReply = await generateSmartResponse({
          workspaceId: account.workspaceId,
          userId,
          userMessage: lastUserMessage || step.aiInstruction || "سلام",
          flowState: step.aiInstruction || "پاسخ کوتاه و کاربردی بر اساس هدف کمپین",
        });
        if (smartReply) {
          await senders.sendDirectMessage(accessToken, account.instagramId, userId, smartReply);
        }
      } catch (aiErr) {
        console.error("[Flow AI Reply] Silent catch:", aiErr);
      }
      continue;
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
          step: "FLOW_NODE",
          automationId: automation.id,
          activeNodeId: step.nodeId,
        },
        update: {
          step: "FLOW_NODE",
          automationId: automation.id,
          activeNodeId: step.nodeId,
        },
      });
    }

    // 3. Dispatch Visual Media / Carousels / Quick Replies / Text
    if (step.mediaToSend && step.mediaToSend.mediaUrl) {
      await senders.sendDirectMediaMessage(
        accessToken,
        account.instagramId,
        userId,
        step.mediaToSend.mediaType,
        step.mediaToSend.mediaUrl
      );
      if (step.mediaToSend.caption && step.mediaToSend.mediaType !== "audio") {
        await senders.sendDirectMessage(
          accessToken,
          account.instagramId,
          userId,
          step.mediaToSend.caption
        );
      }
    } else if (step.carouselToSend && step.carouselToSend.cards.length > 0) {
      const genericElements = step.carouselToSend.cards.map((c) => ({
        title: c.title || "محصول",
        subtitle: c.subtitle,
        image_url: c.imageUrl,
        buttons: c.buttons
          .filter((b) => b.title && (b.type === "postback" || (b.url && b.url !== "https://")))
          .map((b) =>
            b.type === "postback"
              ? {
                  type: "postback" as const,
                  title: b.title,
                  payload: b.payload || `flow_btn:${automation.id}:${step.nodeId}:${b.id}`,
                }
              : {
                  type: "web_url" as const,
                  title: b.title,
                  url: b.url || "#",
                }
          ),
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
        step.quickRepliesToSend.text || step.dmMessageToSend || "لطفاً یکی از گزینه‌ها رو انتخاب کنید:",
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

/**
 * Executes a specific flow branch and dispatches resulting messages/actions to the user.
 * Used for ManyChat button postbacks, quick replies, and nested node branching.
 */
export async function executeFlowBranchAndDispatch({
  automation,
  account,
  accessToken,
  userId,
  username,
  startNodeId,
  clickedButtonId,
  clickedButtonPayload,
}: {
  automation: any;
  account: any;
  accessToken: string;
  userId: string;
  username?: string;
  startNodeId: string;
  clickedButtonId?: string;
  clickedButtonPayload?: string;
}): Promise<FlowStepResult[]> {
  if (!automation?.flowGraph) return [];
  const graph = automation.flowGraph as unknown as FlowGraph;

  const sendDirectMessage = async (_t: string, _accId: string, uId: string, msg: string) => {
    return providerManager.sendTextMessage(account.id, uId, msg);
  };

  const sendDirectMessageWithLinkButton = async (
    _t: string,
    _accId: string,
    uId: string,
    msg: string,
    lbl: string,
    url: string
  ) => {
    return providerManager.sendTextMessage(account.id, uId, msg, {
      buttons: [{ type: "web_url", title: lbl, url }],
    });
  };

  const sendDirectMediaMessage = async (
    _t: string,
    _accId: string,
    uId: string,
    type: "image" | "video" | "audio",
    url: string
  ) => {
    const attType = type === "audio" ? "voice" : type;
    return providerManager.sendAttachment(account.id, uId, attType, url);
  };

  const sendDirectGenericTemplate = async (_t: string, _accId: string, uId: string, elements: any[]) => {
    return providerManager.sendGenericTemplate(account.id, uId, elements);
  };

  const sendDirectQuickReplies = async (
    _t: string,
    _accId: string,
    uId: string,
    text: string,
    quickReplies: any[]
  ) => {
    return providerManager.sendTextMessage(account.id, uId, text, {
      quick_replies: quickReplies.map((qr) => ({
        content_type: "text",
        title: qr.title,
        payload: qr.payload,
      })),
    });
  };

  const sendDirectMessageWithMultipleButtons = async (
    _t: string,
    _accId: string,
    uId: string,
    text: string,
    buttons: any[]
  ) => {
    return providerManager.sendTextMessage(account.id, uId, text, {
      buttons: buttons.map((b) => ({
        type: b.type === "web_url" ? "web_url" : "postback",
        title: b.title,
        url: b.url,
        payload: b.payload,
      })),
    });
  };

  const userTags = await getLeadTags(account.workspaceId, userId);

  const graphResults = await executeFlowGraph(
    graph,
    {
      workspaceId: account.workspaceId,
      instagramAccountId: account.instagramId,
      accountId: account.id,
      automationId: automation.id,
      userId,
      username,
      userTags,
      clickedButtonId,
      clickedButtonPayload,
    },
    startNodeId
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

  return graphResults;
}

/**
 * Resumes a delayed flow branch triggered by a Smart Delay node.
 * Strictly enforces Meta 24-hour window, human handover, circuit breaker, and rate limits.
 */
export async function processResumeFlowNode(payload: {
  instagramAccountId: string;
  userId: string;
  username?: string;
  automationId: string;
  startNodeId: string;
}): Promise<void> {
  const { instagramAccountId, userId, username, automationId, startNodeId } = payload;

  // 1. Account cooldown guard
  const cooldown = isAccountInCooldown(instagramAccountId);
  if (cooldown.inCooldown) {
    console.warn(`[Compliance] Skipped delayed flow resume for ${userId}: account cooldown active.`);
    return;
  }

  // 2. Meta 24-Hour Messaging Policy & Human Handover guard
  const windowStatus = await hasOpen24HourWindow(instagramAccountId, userId);
  if (!windowStatus.open) {
    console.warn(
      `[Compliance] Skipped delayed flow resume for ${userId}: 24-hour messaging window is not open / expired.`
    );
    return;
  }
  if (windowStatus.isHumanHandover) {
    console.info(`[Compliance] Skipped delayed flow resume for ${userId}: human handover active.`);
    return;
  }

  const account = await prisma.instagramAccount.findUnique({
    where: { instagramId: instagramAccountId },
  });
  if (!account) return;

  // Meta Compliance: Never process self-messages / echoes from the page itself
  if (
    !userId ||
    userId === "unknown" ||
    userId === account.instagramId ||
    (account.boxAccountId && userId === account.boxAccountId)
  ) {
    return;
  }

  const rateLimit = await reserveDMSlot(instagramAccountId, "DIRECT_MESSAGE", 0);
  if (!rateLimit.allowed) {
    if (rateLimit.shouldRequeue) {
      await enqueueJob("resume-flow-node", payload, rateLimit.requeueDelayMs);
    }
    return;
  }

  const automation = await prisma.automation.findFirst({
    where: { id: automationId, isActive: true },
    include: { trackedLinks: true },
  });
  if (!automation || !automation.flowGraph) return;

  await applyDangerZoneBackoff();

  let accessToken = "";
  if (account.accessToken) {
    try {
      accessToken = safeDecryptToken(account.accessToken);
    } catch {
      // BoxAPI primary account
    }
  }

  await executeFlowBranchAndDispatch({
    automation,
    account,
    accessToken,
    userId,
    username,
    startNodeId,
  });
}
