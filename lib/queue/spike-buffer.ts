import { prisma } from "@/lib/db/client";
import { getFeatureConfig, isFeatureEnabled } from "@/lib/flags/feature-flags";

interface QueuedWebhookMessage {
  workspaceId: string;
  instagramAccountId: string;
  commentId?: string;
  commenterId: string;
  commentText: string;
  payload: any;
  receivedAt: Date;
}

const memoryBuffer: QueuedWebhookMessage[] = [];

export async function processSpikeBuffer(item: QueuedWebhookMessage): Promise<{ buffered: boolean }> {
  const enabled = await isFeatureEnabled("SPIKE_BUFFER", item.workspaceId);
  if (!enabled) {
    return { buffered: false };
  }

  const config = await getFeatureConfig("SPIKE_BUFFER", item.workspaceId);
  memoryBuffer.push(item);

  if (memoryBuffer.length >= config.maxBatchSize) {
    await flushSpikeBuffer();
  }

  return { buffered: true };
}

export async function flushSpikeBuffer(): Promise<number> {
  if (memoryBuffer.length === 0) return 0;
  const itemsToFlush = memoryBuffer.splice(0, memoryBuffer.length);

  try {
    const jobs = itemsToFlush.map((item) => ({
      name: item.commentId ? "process-comment" : "process-dm",
      payload: item.payload,
      status: "PENDING" as const,
      runAt: new Date(),
    }));

    await prisma.backgroundJob.createMany({
      data: jobs,
    });

    return jobs.length;
  } catch (error) {
    console.error("Failed to flush spike buffer to DB queue:", error);
    // Put items back in buffer
    memoryBuffer.unshift(...itemsToFlush);
    return 0;
  }
}
