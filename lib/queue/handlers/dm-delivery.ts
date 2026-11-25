import { prisma } from "@/lib/db/client";
import { applyDangerZoneBackoff } from "@/lib/meta/client";
import { selectDmMessageVariation } from "@/lib/automation/ab-testing";
import {
  buildTrackedUrl,
  renderMessageWithTracking,
  renderMessageWithoutLink,
} from "@/lib/tracking/message";
import { executeFlowGraph } from "@/lib/flow/flow-engine";
import type { FlowGraph } from "@/lib/flow/types";
import type { AutomationWithAccountAndLinks } from "./types";
import { providerManager } from "@/lib/providers/manager/provider-manager";
import { addTagToLead, removeTagFromLead, getLeadTags } from "@/lib/crm/tags";
import { enrollUserInDrip } from "@/lib/drip/drip-engine";
import { setHumanHandover } from "@/lib/automation/human-handover";
import { generateSmartResponse } from "@/lib/ai/features/smart-responses";
import { enqueueJob } from "@/lib/queue/mysql-queue";

export async function deliverPrivateReply(params: {
  automation: AutomationWithAccountAndLinks;
  accessToken: string;
  commentId: string;
  commenterId: string;
  commenterName: string | null;
  commentText: string;
}): Promise<void> {
  const {
    automation,
    accessToken,
    commentId,
    commenterId,
    commenterName,
    commentText,
  } = params;

  // Apply danger zone backoff before sending
  await applyDangerZoneBackoff();

  const accountId = automation.instagramAccount.id;

  const hasFlowGraph =
    automation.flowGraph &&
    typeof automation.flowGraph === "object" &&
    Array.isArray((automation.flowGraph as any).nodes) &&
    (automation.flowGraph as any).nodes.length > 0;

  if (hasFlowGraph) {
    const userTags = await getLeadTags(automation.workspaceId, commenterId).catch(() => []);
    const graphResults = await executeFlowGraph(
      automation.flowGraph as unknown as FlowGraph,
      {
        workspaceId: automation.workspaceId,
        instagramAccountId: automation.instagramAccount.instagramId,
        accountId,
        automationId: automation.id,
        userId: commenterId,
        username: commenterName ?? undefined,
        userMessage: commentText,
        userTags,
      }
    );

    let sentPrivateReplyForComment = false;

    for (const step of graphResults) {
      if (step.tagAction && step.tagAction.tagName?.trim()) {
        if (step.tagAction.action === "add") {
          await addTagToLead(automation.workspaceId, automation.instagramAccount.instagramId, commenterId, step.tagAction.tagName.trim());
        } else {
          await removeTagFromLead(automation.workspaceId, commenterId, step.tagAction.tagName.trim());
        }
      }

      if (step.enrollDripCampaignId && step.enrollDripCampaignId.trim()) {
        await enrollUserInDrip({
          workspaceId: automation.workspaceId,
          instagramAccountId: automation.instagramAccount.instagramId,
          userId: commenterId,
          campaignId: step.enrollDripCampaignId.trim(),
        });
      }

      if (step.isHumanHandover) {
        await setHumanHandover(automation.workspaceId, automation.instagramAccount.instagramId, commenterId, true);
      }

      if (step.nodeType === "smart_delay" && step.nextStepNodeId && (step.delayMs || step.delayMinutes)) {
        const delayMs = step.delayMs || (step.delayMinutes || 5) * 60_000;
        await enqueueJob(
          "resume-flow-node",
          {
            instagramAccountId: automation.instagramAccount.instagramId,
            userId: commenterId,
            username: commenterName ?? undefined,
            automationId: automation.id,
            startNodeId: step.nextStepNodeId,
          },
          delayMs
        );
        continue;
      }

      if (step.isAiReply) {
        try {
          const smartReply = await generateSmartResponse({
            workspaceId: automation.workspaceId,
            userId: commenterId,
            userMessage: commentText || step.aiInstruction || "سلام",
            flowState: step.aiInstruction || "پاسخ کوتاه و کاربردی بر اساس هدف کمپین",
          });
          if (smartReply) {
            if (!sentPrivateReplyForComment) {
              await providerManager.privateReply(accountId, commentId, smartReply);
              sentPrivateReplyForComment = true;
            } else {
              await providerManager.sendTextMessage(accountId, commenterId, smartReply);
            }
          }
        } catch (aiErr) {
          console.error("[DmDelivery Flow AI Reply] Silent catch:", aiErr);
        }
        continue;
      }

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
            automationId: automation.id,
            activeNodeId: step.nodeId,
            step: "FLOW_NODE",
          },
          update: {
            automationId: automation.id,
            activeNodeId: step.nodeId,
            step: "FLOW_NODE",
            updatedAt: new Date(),
          },
        });
      }

      if (step.mediaToSend && step.mediaToSend.mediaUrl) {
        const attType = step.mediaToSend.mediaType === "audio" ? "voice" : step.mediaToSend.mediaType;
        await providerManager.sendAttachment(accountId, commenterId, attType, step.mediaToSend.mediaUrl);
        if (step.mediaToSend.caption && step.mediaToSend.mediaType !== "audio") {
          await providerManager.sendTextMessage(accountId, commenterId, step.mediaToSend.caption);
        }
      } else if (step.carouselToSend && step.carouselToSend.cards.length > 0) {
        const elements = step.carouselToSend.cards.map((c) => ({
          title: c.title || "محصول",
          subtitle: c.subtitle,
          image_url: c.imageUrl,
          buttons: c.buttons
            .filter((b) => b.title && (b.type === "postback" || (b.url && b.url !== "https://")))
            .map((b) =>
              b.type === "postback"
                ? { type: "postback" as const, title: b.title, payload: b.payload || `flow_btn:${automation.id}:${step.nodeId}:${b.id}` }
                : { type: "web_url" as const, title: b.title, url: b.url || "#" }
            ),
        }));
        await providerManager.sendGenericTemplate(accountId, commenterId, elements);
      } else if (step.quickRepliesToSend && step.quickRepliesToSend.chips.length > 0) {
        const qrBody = step.quickRepliesToSend.text || step.dmMessageToSend || "لطفاً یکی از گزینه‌ها رو انتخاب کنید:";
        const qrs = step.quickRepliesToSend.chips.map((c) => ({
          content_type: "text" as const,
          title: c.title,
          payload: c.payload || c.title,
        }));
        if (!sentPrivateReplyForComment) {
          await providerManager.privateReply(accountId, commentId, qrBody);
          sentPrivateReplyForComment = true;
          await providerManager.sendTextMessage(accountId, commenterId, qrBody, { quick_replies: qrs }).catch(() => {});
        } else {
          await providerManager.sendTextMessage(accountId, commenterId, qrBody, { quick_replies: qrs });
        }
      } else if (step.buttons && step.buttons.length > 0) {
        const bodyText = renderMessageWithTracking({
          message: step.dmMessageToSend || "لطفاً یکی از گزینه‌ها رو انتخاب کنید:",
          commenterName,
          trackedLinks: automation.trackedLinks,
        });
        const metaButtons = step.buttons.map((b) => ({
          type: b.type,
          title: b.title,
          url: b.url,
          payload: b.payload,
        }));
        if (!sentPrivateReplyForComment) {
          await providerManager.privateReply(accountId, commentId, bodyText, { buttons: metaButtons });
          sentPrivateReplyForComment = true;
        } else {
          await providerManager.sendTextMessage(accountId, commenterId, bodyText, { buttons: metaButtons });
        }
      } else if (step.dmMessageToSend) {
        if (step.linkButton) {
          const msgOpts = {
            buttons: [{ type: "web_url" as const, title: step.linkButton.label, url: step.linkButton.url }],
          };
          if (!sentPrivateReplyForComment) {
            await providerManager.privateReply(accountId, commentId, step.dmMessageToSend, msgOpts);
            sentPrivateReplyForComment = true;
          } else {
            await providerManager.sendTextMessage(accountId, commenterId, step.dmMessageToSend, msgOpts);
          }
        } else {
          const dmMessage = renderMessageWithTracking({
            message: step.dmMessageToSend,
            commenterName,
            trackedLinks: automation.trackedLinks,
          });
          if (!sentPrivateReplyForComment) {
            await providerManager.privateReply(accountId, commentId, dmMessage);
            sentPrivateReplyForComment = true;
          } else {
            await providerManager.sendTextMessage(accountId, commenterId, dmMessage);
          }
        }
      }

      if (step.requiresInput) {
        break;
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
    return;
  }

  const useOpeningDm =
    automation.openingDmEnabled &&
    Boolean(automation.openingDmMessage) &&
    Boolean(automation.openingDmButtonLabel);

  const hasLeadForm = Boolean(automation.collectName || automation.collectPhone);
  const hasDmMessage = Boolean(automation.dmMessage && automation.dmMessage.trim());

  let sendResult: any = null;

  if (useOpeningDm) {
    const openingText = renderMessageWithTracking({
      message: automation.openingDmMessage as string,
      commenterName,
      trackedLinks: [],
    });
    sendResult = await providerManager.privateReply(
      accountId,
      commentId,
      openingText,
      {
        buttons: [
          {
            type: "postback",
            title: automation.openingDmButtonLabel as string,
            payload: `reveal:${automation.id}`,
          },
        ],
      }
    );
  } else if (hasLeadForm) {
    // Always use Instagram's single allowed privateReply slot to send the first Lead Form prompt.
    // Any configured `dmMessage` ("And then, they will get") is delivered AFTER the form completes.
    const initialStep = automation.collectName ? "AWAITING_NAME" : "AWAITING_PHONE";
    const promptText =
      initialStep === "AWAITING_NAME"
        ? automation.leadPromptName || "سلام! لطفاً اسم و فامیلتون رو برام بنویسید 🙏"
        : automation.leadPromptPhone || "سلام! لطفاً شماره موبایلتون رو بفرستید 📱";

    sendResult = await providerManager.privateReply(accountId, commentId, promptText);
  } else if (automation.trackedLinks[0]) {
    const selectedMessage = selectDmMessageVariation(automation.dmMessage);
    const bodyText =
      renderMessageWithoutLink({
        message: selectedMessage,
        commenterName,
      }) || "Here's your link:";
    sendResult = await providerManager.privateReply(
      accountId,
      commentId,
      bodyText,
      {
        buttons: [
          {
            type: "web_url",
            title: automation.linkButtonLabel || "Open link",
            url: buildTrackedUrl(automation.trackedLinks[0].slug),
          },
        ],
      }
    );
  } else {
    const selectedMessage = selectDmMessageVariation(automation.dmMessage);
    const dmMessage = renderMessageWithTracking({
      message: selectedMessage,
      commenterName,
      trackedLinks: automation.trackedLinks,
    });
    sendResult = await providerManager.privateReply(accountId, commentId, dmMessage);
  }

  if (sendResult && !sendResult.success) {
    console.error(`[DmDelivery] Private reply failed for comment ${commentId}:`, sendResult.error);
    await prisma.dmLog.update({
      where: {
        automationId_commentId: {
          automationId: automation.id,
          commentId,
        },
      },
      data: {
        status: "FAILED",
        errorMessage: sendResult.error || "Provider failed to send private reply",
      },
    });
    return;
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

  if (!useOpeningDm && hasLeadForm) {
    const initialStep = automation.collectName ? "AWAITING_NAME" : "AWAITING_PHONE";
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
        step: initialStep,
        automationId: automation.id,
        activeNodeId: null,
        metadata: {},
      },
      update: {
        step: initialStep,
        automationId: automation.id,
        activeNodeId: null,
        metadata: {},
      },
    });
  }
}

export async function deliverPostbackReveal(params: {
  automation: AutomationWithAccountAndLinks;
  accessToken: string;
  userId: string;
  commenterName: string | null;
  dedupeId: string;
}): Promise<void> {
  const { automation, accessToken, userId, commenterName, dedupeId } = params;

  await applyDangerZoneBackoff();

  const accountId = automation.instagramAccount.id;
  const primaryLink = automation.trackedLinks[0];
  const hasLeadForm = Boolean(automation.collectName || automation.collectPhone);

  if (hasLeadForm) {
    const initialStep = automation.collectName ? "AWAITING_NAME" : "AWAITING_PHONE";
    await prisma.conversationState.upsert({
      where: {
        instagramAccountId_userId: {
          instagramAccountId: automation.instagramAccount.instagramId,
          userId,
        },
      },
      create: {
        workspaceId: automation.workspaceId,
        instagramAccountId: automation.instagramAccount.instagramId,
        userId,
        step: initialStep,
        automationId: automation.id,
        activeNodeId: null,
        metadata: {},
      },
      update: {
        step: initialStep,
        automationId: automation.id,
        activeNodeId: null,
        metadata: {},
      },
    });

    const promptText =
      initialStep === "AWAITING_NAME"
        ? automation.leadPromptName || "سلام! لطفاً اسم و فامیلتون رو برام بنویسید 🙏"
        : automation.leadPromptPhone || "سلام! لطفاً شماره موبایلتون رو بفرستید 📱";

    await providerManager.sendTextMessage(accountId, userId, promptText);
  } else if (primaryLink) {
    const bodyText =
      renderMessageWithoutLink({
        message: automation.dmMessage,
        commenterName,
      }) || "Here's your link:";
    await providerManager.sendTextMessage(
      accountId,
      userId,
      bodyText,
      {
        buttons: [
          {
            type: "web_url",
            title: automation.linkButtonLabel || "Open link",
            url: buildTrackedUrl(primaryLink.slug),
          },
        ],
      }
    );
  } else {
    const revealMessage = renderMessageWithTracking({
      message: automation.dmMessage,
      commenterName,
      trackedLinks: automation.trackedLinks,
    });
    await providerManager.sendTextMessage(
      accountId,
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
}
