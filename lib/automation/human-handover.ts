import { prisma } from "@/lib/db/client";
import { getFeatureConfig, isFeatureEnabled } from "@/lib/flags/feature-flags";

export async function checkHumanHandoverState(
  workspaceId: string,
  instagramAccountId: string,
  userId: string,
  incomingText?: string
): Promise<{ isHandover: boolean; reason?: string }> {
  const enabled = await isFeatureEnabled("HUMAN_HANDOVER", workspaceId);
  if (!enabled) {
    return { isHandover: false };
  }

  // Check existing handover state
  const state = await prisma.conversationState.findUnique({
    where: {
      instagramAccountId_userId: {
        instagramAccountId,
        userId,
      },
    },
  });

  if (state?.isHumanHandover) {
    return { isHandover: true, reason: "Active handover session enabled by admin or keyword" };
  }

  // If text provided, check for handover keywords
  if (incomingText) {
    const config = await getFeatureConfig("HUMAN_HANDOVER", workspaceId);
    const textLower = incomingText.trim().toLowerCase();
    const matchedKeyword = config.keywords.find((kw) => textLower.includes(kw.toLowerCase()));

    if (matchedKeyword) {
      await setHumanHandover(workspaceId, instagramAccountId, userId, true);
      return { isHandover: true, reason: `Matched handover keyword: "${matchedKeyword}"` };
    }
  }

  return { isHandover: false };
}

export async function setHumanHandover(
  workspaceId: string,
  instagramAccountId: string,
  userId: string,
  isHandover: boolean
) {
  return await prisma.conversationState.upsert({
    where: {
      instagramAccountId_userId: {
        instagramAccountId,
        userId,
      },
    },
    update: {
      isHumanHandover: isHandover,
      handoverAt: isHandover ? new Date() : null,
    },
    create: {
      workspaceId,
      instagramAccountId,
      userId,
      isHumanHandover: isHandover,
      handoverAt: isHandover ? new Date() : null,
    },
  });
}
