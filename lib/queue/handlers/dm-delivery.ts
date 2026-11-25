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
import { hasOpen24HourWindow, redactSensitiveFinancialData } from "@/lib/meta/compliance";

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

  // Meta Compliance: Never reply to self-comments or unknown commenters
  if (!commenterId || commenterId === "unknown" || commenterId === automation.instagramAccount.instagramId) {
    return;
  }

  const windowStatus = await hasOpen24HourWindow(
    automation.instagramAccount.instagramId,
    commenterId
  ).catch(() => ({ open: false, isHumanHandover: false, lastInteractedAt: null }));

  if (windowStatus.isHumanHandover) {
    console.info(`[Compliance] Skipping comment DM delivery for ${commenterId}: Human handover active.`);
    return;
  }

  const hasOpen24hWindow = windowStatus.open;

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
    let sentAnyDm = false;

    for (const step of graphResults) {
      if (step.tagAction && step.tagAction.tagName?.trim()) {
        if (step.tagAction.action === "add") {
          await addTagToLead(automation.workspaceId, automation.instagramAccount.instagramId, commenterId, step.tagAction.tagName.trim());
        } else {
          await removeTagFromLead(automation.workspaceId, commenterId, step.tagAction.tagName.trim());
        }
      }

      if (step.enrollDripCampaignId && step.enrollDripCampaignId.trim()) {
        if (hasOpen24hWindow) {
          await enrollUserInDrip({
            workspaceId: automation.workspaceId,
            instagramAccountId: automation.instagramAccount.instagramId,
            userId: commenterId,
            campaignId: step.enrollDripCampaignId.trim(),
          });
        }
      }

      if (step.isHumanHandover) {
        await setHumanHandover(automation.workspaceId, automation.instagramAccount.instagramId, commenterId, true);
      }

      if (step.nodeType === "smart_delay" && step.nextStepNodeId && (step.delayMs || step.delayMinutes)) {
        if (hasOpen24hWindow) {
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
        }
        continue;
      }

      // Meta Compliance Guard: A comment trigger only allows ONE private_reply unless
      // the user already has an open 24-hour DM window from an earlier interaction.
      if (sentPrivateReplyForComment && !hasOpen24hWindow) {
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
        break;
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
              const prRes = await providerManager.privateReply(accountId, commentId, smartReply);
              if (prRes?.success !== false) {
                sentPrivateReplyForComment = true;
                sentAnyDm = true;
              }
            } else if (hasOpen24hWindow) {
              const dmRes = await providerManager.sendTextMessage(accountId, commenterId, smartReply);
              if (dmRes?.success !== false) sentAnyDm = true;
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
        if (!sentPrivateReplyForComment && !hasOpen24hWindow) {
          // Cannot call sendAttachment without an open 24h DM window; use privateReply teaser/link
          const fallbackBody =
            selectDmMessageVariation(step.mediaToSend.caption) ||
            "سلام! برای دریافت فایل یا تصویر، لطفاً همین‌جا یک پیام بفرستید 🙏";
          const prRes = await providerManager.privateReply(accountId, commentId, fallbackBody);
          if (prRes?.success !== false) {
            sentPrivateReplyForComment = true;
            sentAnyDm = true;
          }
        } else if (hasOpen24hWindow) {
          const attType = step.mediaToSend.mediaType === "audio" ? "voice" : step.mediaToSend.mediaType;
          const attRes = await providerManager.sendAttachment(accountId, commenterId, attType, step.mediaToSend.mediaUrl);
          if (attRes?.success !== false) sentAnyDm = true;
          if (step.mediaToSend.caption && step.mediaToSend.mediaType !== "audio") {
            const capRes = await providerManager.sendTextMessage(
              accountId,
              commenterId,
              selectDmMessageVariation(step.mediaToSend.caption)
            );
            if (capRes?.success !== false) sentAnyDm = true;
          }
        }
      } else if (step.carouselToSend && step.carouselToSend.cards.length > 0) {
        if (!sentPrivateReplyForComment && !hasOpen24hWindow) {
          const firstCard = step.carouselToSend.cards[0];
          const firstBtn = firstCard.buttons?.find((b) => b.title && b.url && b.url !== "https://");
          const fallbackMsg = `${firstCard.title || "پیشنهاد ویژه"}${firstCard.subtitle ? `\n${firstCard.subtitle}` : ""}`;
          const prRes = firstBtn
            ? await providerManager.privateReply(accountId, commentId, fallbackMsg, {
                buttons: [{ type: "web_url", title: firstBtn.title, url: firstBtn.url || "#" }],
              })
            : await providerManager.privateReply(accountId, commentId, fallbackMsg);
          if (prRes?.success !== false) {
            sentPrivateReplyForComment = true;
            sentAnyDm = true;
          }
        } else if (hasOpen24hWindow) {
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
          const carRes = await providerManager.sendGenericTemplate(accountId, commenterId, elements);
          if (carRes?.success !== false) sentAnyDm = true;
        }
      } else if (step.quickRepliesToSend && step.quickRepliesToSend.chips.length > 0) {
        const qrBody = selectDmMessageVariation(
          step.quickRepliesToSend.text || step.dmMessageToSend || "لطفاً یکی از گزینه‌ها رو انتخاب کنید:"
        );
        const qrs = step.quickRepliesToSend.chips.map((c) => ({
          content_type: "text" as const,
          title: c.title,
          payload: c.payload || c.title,
        }));
        if (!sentPrivateReplyForComment) {
          const prRes = await providerManager.privateReply(accountId, commentId, qrBody);
          if (prRes?.success !== false) {
            sentPrivateReplyForComment = true;
            sentAnyDm = true;
          }
          if (hasOpen24hWindow) {
            await providerManager.sendTextMessage(accountId, commenterId, qrBody, { quick_replies: qrs }).catch(() => {});
          }
        } else if (hasOpen24hWindow) {
          const qrRes = await providerManager.sendTextMessage(accountId, commenterId, qrBody, { quick_replies: qrs });
          if (qrRes?.success !== false) sentAnyDm = true;
        }
      } else if (step.buttons && step.buttons.length > 0) {
        const bodyText = renderMessageWithTracking({
          message: selectDmMessageVariation(step.dmMessageToSend || "لطفاً یکی از گزینه‌ها رو انتخاب کنید:"),
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
          const prRes = await providerManager.privateReply(accountId, commentId, bodyText, { buttons: metaButtons });
          if (prRes?.success !== false) {
            sentPrivateReplyForComment = true;
            sentAnyDm = true;
          }
        } else if (hasOpen24hWindow) {
          const btnRes = await providerManager.sendTextMessage(accountId, commenterId, bodyText, { buttons: metaButtons });
          if (btnRes?.success !== false) sentAnyDm = true;
        }
      } else if (step.dmMessageToSend) {
        const selectedFlowMsg = selectDmMessageVariation(step.dmMessageToSend);
        if (step.linkButton) {
          const msgOpts = {
            buttons: [{ type: "web_url" as const, title: step.linkButton.label, url: step.linkButton.url }],
          };
          if (!sentPrivateReplyForComment) {
            const prRes = await providerManager.privateReply(accountId, commentId, selectedFlowMsg, msgOpts);
            if (prRes?.success !== false) {
              sentPrivateReplyForComment = true;
              sentAnyDm = true;
            }
          } else if (hasOpen24hWindow) {
            const lnkRes = await providerManager.sendTextMessage(accountId, commenterId, selectedFlowMsg, msgOpts);
            if (lnkRes?.success !== false) sentAnyDm = true;
          }
        } else {
          const dmMessage = renderMessageWithTracking({
            message: selectedFlowMsg,
            commenterName,
            trackedLinks: automation.trackedLinks,
          });
          if (!sentPrivateReplyForComment) {
            const prRes = await providerManager.privateReply(accountId, commentId, dmMessage);
            if (prRes?.success !== false) {
              sentPrivateReplyForComment = true;
              sentAnyDm = true;
            }
          } else if (hasOpen24hWindow) {
            const dmRes = await providerManager.sendTextMessage(accountId, commenterId, dmMessage);
            if (dmRes?.success !== false) sentAnyDm = true;
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
      data: sentAnyDm
        ? {
            status: "SENT",
            dmSentAt: new Date(),
            errorMessage: null,
          }
        : {
            status: "FAILED",
            errorMessage:
              graphResults.length === 0
                ? "Flow trigger did not match comment keywords"
                : "Flow produced no outbound message",
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
    const selectedOpening = selectDmMessageVariation(automation.openingDmMessage as string);
    const openingText = renderMessageWithTracking({
      message: selectedOpening,
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
    const promptText = selectDmMessageVariation(
      initialStep === "AWAITING_NAME"
        ? automation.leadPromptName || "سلام! لطفاً اسم و فامیلتون رو برام بنویسید 🙏"
        : automation.leadPromptPhone || "سلام! لطفاً شماره موبایلتون رو بفرستید 📱"
    );

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

    const promptText = selectDmMessageVariation(
      initialStep === "AWAITING_NAME"
        ? automation.leadPromptName || "سلام! لطفاً اسم و فامیلتون رو برام بنویسید 🙏"
        : automation.leadPromptPhone || "سلام! لطفاً شماره موبایلتون رو بفرستید 📱"
    );

    await providerManager.sendTextMessage(accountId, userId, promptText);
  } else if (primaryLink) {
    const selectedRevealMsg = selectDmMessageVariation(automation.dmMessage);
    const bodyText =
      renderMessageWithoutLink({
        message: selectedRevealMsg,
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
      message: selectDmMessageVariation(automation.dmMessage),
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
