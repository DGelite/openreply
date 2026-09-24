import crypto from "crypto";
import { prisma } from "@/lib/db/client";
import { isFeatureEnabled } from "@/lib/flags/feature-flags";

export function generateEventHash(payload: any): string {
  const normalizedStr = JSON.stringify(payload);
  return crypto.createHash("sha256").update(normalizedStr).digest("hex");
}

export async function isDuplicateEvent(
  commentOrMessageId: string,
  workspaceId?: string
): Promise<boolean> {
  const enabled = await isFeatureEnabled("DEDUP", workspaceId);
  if (!enabled) {
    return false;
  }

  try {
    const existing = await prisma.processedComment.findUnique({
      where: { commentId: commentOrMessageId },
    });
    return !!existing;
  } catch (error) {
    console.error("Error checking event deduplication:", error);
    return false;
  }
}

export async function markEventProcessed(
  instagramAccountId: string,
  commentOrMessageId: string,
  source: "WEBHOOK" | "POLLING" = "WEBHOOK"
): Promise<void> {
  try {
    await prisma.processedComment.upsert({
      where: { commentId: commentOrMessageId },
      update: { seenAt: new Date() },
      create: {
        instagramAccountId,
        commentId: commentOrMessageId,
        source,
      },
    });
  } catch (error) {
    console.error("Error marking event processed for dedup:", error);
  }
}
