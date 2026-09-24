import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/client";

export type CommentSource = "WEBHOOK" | "POLLING";

export interface ProcessCommentJob {
  instagramAccountId: string;
  commentId: string;
  commentText: string;
  commenterId: string;
  commenterName?: string;
  mediaId: string;
  requeueAttempt?: number;
  source?: CommentSource;
}

export interface ProcessPostbackJob {
  instagramAccountId: string;
  userId: string;
  payload: string;
  mid?: string;
  requeueAttempt?: number;
}

export const POSTBACK_JOB_NAME = "process-postback";

/**
 * Enqueues a job into the BackgroundJob table transactionally.
 */
export async function enqueueJob(
  name: string,
  payload: any,
  runAtDelayMs: number = 0,
  tx?: Prisma.TransactionClient
) {
  const runAt = new Date(Date.now() + runAtDelayMs);
  
  const createData = {
    name,
    payload,
    runAt,
    status: "PENDING" as const,
  };

  if (tx) {
    return tx.backgroundJob.create({ data: createData });
  } else {
    return prisma.backgroundJob.create({ data: createData });
  }
}

/**
 * Dequeues a batch of pending jobs atomically WITHOUT interactive transactions.
 * Prevents P2028 transaction timeouts and connection pool bottlenecks under heavy load.
 */
export async function dequeueBatch(batchSize: number = 10) {
  const now = new Date();

  // 1. Find pending candidate IDs or stale locked jobs (>5 minutes)
  const candidates = await prisma.backgroundJob.findMany({
    where: {
      OR: [
        { status: "PENDING", runAt: { lte: now } },
        { status: "RUNNING", lockedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) } },
      ],
    },
    orderBy: { runAt: "asc" },
    take: batchSize,
    select: { id: true },
  });

  if (candidates.length === 0) return [];

  const candidateIds = candidates.map((c) => c.id);

  // 2. Atomically claim them using updateMany (atomic check-and-set)
  const claimed = await prisma.backgroundJob.updateMany({
    where: {
      id: { in: candidateIds },
      status: "PENDING",
    },
    data: {
      status: "RUNNING",
      lockedAt: now,
    },
  });

  if (claimed.count === 0) return [];

  // 3. Fetch full payload for claimed jobs
  const jobs = await prisma.backgroundJob.findMany({
    where: {
      id: { in: candidateIds },
      status: "RUNNING",
    },
  });

  return jobs.map((job) => {
    let parsedPayload = job.payload;
    if (typeof parsedPayload === "string") {
      try {
        parsedPayload = JSON.parse(parsedPayload);
      } catch (e) {}
    }
    return {
      id: job.id,
      name: job.name,
      payload: parsedPayload,
      attempts: job.attempts,
    };
  });
}

/**
 * Backward compatible single dequeue call wrapping dequeueBatch.
 */
export async function dequeueJob() {
  const batch = await dequeueBatch(1);
  return batch.length > 0 ? batch[0] : null;
}

/**
 * Marks a job as completed.
 */
export async function completeJob(id: string) {
  await prisma.backgroundJob.update({
    where: { id },
    data: {
      status: "COMPLETED",
      lockedAt: null,
    },
  });
}

/**
 * Marks a job as failed, and optionally sets a backoff for a retry.
 */
export async function failJob(id: string, error: string, attemptsMade: number, shouldRetry: boolean = true) {
  const maxAttempts = 3;
  const BACKOFF_DELAYS = [5 * 60 * 1000, 15 * 60 * 1000, 45 * 60 * 1000];
  
  if (shouldRetry && attemptsMade < maxAttempts) {
    const delay = BACKOFF_DELAYS[Math.min(attemptsMade, BACKOFF_DELAYS.length - 1)];
    await prisma.backgroundJob.update({
      where: { id },
      data: {
        status: "PENDING",
        error,
        lockedAt: null,
        runAt: new Date(Date.now() + delay),
        attempts: { increment: 1 },
      },
    });
  } else {
    // Permanent failure
    await prisma.backgroundJob.update({
      where: { id },
      data: {
        status: "FAILED",
        error,
        lockedAt: null,
        attempts: { increment: 1 },
      },
    });
  }
}



