import { prisma } from "@/lib/db/client";
import { isFeatureEnabled } from "@/lib/flags/feature-flags";

export async function pushToDLQ(params: {
  workspaceId?: string;
  source: "WEBHOOK" | "DM_QUEUE" | "COMMENT_QUEUE" | "SMS_FALLBACK";
  payload: any;
  errorMessage: string;
}) {
  const enabled = await isFeatureEnabled("DLQ", params.workspaceId);
  if (!enabled) {
    console.warn("DLQ feature disabled. Logged error:", params.errorMessage);
    return null;
  }

  try {
    return await prisma.deadLetterMessage.create({
      data: {
        workspaceId: params.workspaceId || null,
        source: params.source,
        payload: params.payload || {},
        errorMessage: params.errorMessage,
        status: "FAILED",
      },
    });
  } catch (error) {
    console.error("Failed to push message to DLQ:", error);
    return null;
  }
}

export async function getDLQMessages(workspaceId?: string, status = "FAILED") {
  return await prisma.deadLetterMessage.findMany({
    where: {
      ...(workspaceId ? { workspaceId } : {}),
      status,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function updateDLQStatus(id: string, status: "FAILED" | "RETRIED" | "RESOLVED" | "IGNORED") {
  return await prisma.deadLetterMessage.update({
    where: { id },
    data: {
      status,
      attempts: { increment: 1 },
      updatedAt: new Date(),
    },
  });
}
