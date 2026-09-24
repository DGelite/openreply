import { prisma } from "@/lib/db/client";
import {
  sendDirectMessage,
  sendDirectMessageWithLinkButton,
  sendPrivateReply,
  sendPrivateReplyWithButton,
  sendPrivateReplyWithLinkButton,
  applyDangerZoneBackoff,
} from "@/lib/meta/client";
import { selectDmMessageVariation } from "@/lib/automation/ab-testing";
import {
  buildTrackedUrl,
  renderMessageWithTracking,
  renderMessageWithoutLink,
} from "@/lib/tracking/message";
import { executeFlowGraph } from "@/lib/flow/flow-engine";
import type { FlowGraph } from "@/lib/flow/types";
import type { AutomationWithAccountAndLinks } from "./types";

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

  // Apply danger zone backoff before every Meta send
  await applyDangerZoneBackoff();

  const hasFlowGraph =
    automation.flowGraph &&
    typeof automation.flowGraph === "object" &&
    Array.isArray((automation.flowGraph as any).nodes) &&
    (automation.flowGraph as any).nodes.length > 0;

  if (hasFlowGraph) {
    const graphResults = await executeFlowGraph(
      automation.flowGraph as unknown as FlowGraph,
      {
        workspaceId: automation.workspaceId,
        instagramAccountId: automation.instagramAccount.instagramId,
        userId: commenterId,
        username: commenterName ?? undefined,
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
    return;
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

  const primaryLink = automation.trackedLinks[0];

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
}
