import { prisma } from "@/lib/db/client";
import { sendCommentReply, applyDangerZoneBackoff } from "@/lib/meta/client";
import { renderMessageWithTracking } from "@/lib/tracking/message";
import { formatError } from "./error-handler";
import type { AutomationWithAccountAndLinks } from "./types";

export async function handlePublicCommentReply(params: {
  automation: AutomationWithAccountAndLinks;
  accessToken: string;
  commentId: string;
  commenterName: string | null;
  existingLog: { publicReplySentAt: Date | null } | null;
}): Promise<void> {
  const { automation, accessToken, commentId, commenterName, existingLog } = params;

  const replyPool =
    Array.isArray(automation.publicReplyMessages) && automation.publicReplyMessages.length > 0
      ? (automation.publicReplyMessages as string[])
      : automation.publicReplyMessage
        ? [automation.publicReplyMessage]
        : [];

  if (
    !automation.publicReplyEnabled ||
    replyPool.length === 0 ||
    existingLog?.publicReplySentAt
  ) {
    return;
  }

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
