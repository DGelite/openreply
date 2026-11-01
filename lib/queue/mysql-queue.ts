import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import crypto from "node:crypto";

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

import { EventEmitter } from "node:events";

export const queueEvents = new EventEmitter();
queueEvents.setMaxListeners(50);

let lastStaleRecoveryAt = 0;
const STALE_RECOVERY_INTERVAL_MS = 60_000;

/**
 * Recovers stale running jobs that crashed or hung (> 5 minutes).
 * Throttled to at most once per minute to avoid hammering the DB on every poll.
 */
export async function recoverStaleJobs(staleAgeMs: number = 5 * 60 * 1000): Promise<number> {
  const staleThreshold = new Date(Date.now() - staleAgeMs);
  try {
    // 1. Permanently fail poison-pill jobs that exceeded max attempts (>=3) while locked
    await prisma.backgroundJob.updateMany({
      where: {
        status: "RUNNING",
        lockedAt: { lt: staleThreshold },
        attempts: { gte: 3 },
      },
      data: {
        status: "FAILED",
        error: "Job timed out after 5 minutes or worker crashed (max attempts exceeded)",
        lockedAt: null,
      },
    });

    // 2. Recover jobs with attempts < 3 back to PENDING for retry, incrementing attempts
    const res = await prisma.backgroundJob.updateMany({
      where: {
        status: "RUNNING",
        lockedAt: { lt: staleThreshold },
        attempts: { lt: 3 },
      },
      data: {
        status: "PENDING",
        lockedAt: null,
        attempts: { increment: 1 },
      },
    });
    return res.count;
  } catch (err) {
    console.error("[Queue] Failed to recover stale jobs:", err);
    return 0;
  }
}

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

  const result = tx
    ? await tx.backgroundJob.create({ data: createData })
    : await prisma.backgroundJob.create({ data: createData });

  // Signal in-process workers immediately for 0ms idle latency
  queueEvents.emit("jobEnqueued");
  return result;
}

/**
 * Enqueues a batch of jobs in a single database round-trip via createMany.
 */
export async function enqueueJobsBatch(
  jobs: Array<{ name: string; payload: any; runAtDelayMs?: number }>,
  tx?: Prisma.TransactionClient
) {
  if (!jobs || jobs.length === 0) return { count: 0 };
  const now = Date.now();
  const createData = jobs.map((j) => ({
    name: j.name,
    payload: j.payload,
    runAt: new Date(now + (j.runAtDelayMs || 0)),
    status: "PENDING" as const,
  }));

  const client = tx || prisma;
  const result = await client.backgroundJob.createMany({
    data: createData,
  });

  queueEvents.emit("jobEnqueued");
  return result;
}

/**
 * Extracts a stable conversation identifier from a job payload.
 * Supports Instagram DM (userId/recipientId/senderId) and Comment replies (commenterId).
 */
export function getConversationKey(payload: any): string | null {
  if (!payload) return null;
  let parsed = payload;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }
  if (typeof parsed !== "object") return null;

  const accId = typeof parsed.instagramAccountId === "string" ? parsed.instagramAccountId : "global";
  const targetId =
    (typeof parsed.userId === "string" && parsed.userId) ||
    (typeof parsed.commenterId === "string" && parsed.commenterId) ||
    (typeof parsed.recipientId === "string" && parsed.recipientId) ||
    (typeof parsed.senderId === "string" && parsed.senderId) ||
    null;

  if (!targetId) return null;
  return `${accId}:${targetId}`;
}

export function parseConversationParams(payload: any): { accId: string; targetId: string } | null {
  if (!payload) return null;
  let parsed = payload;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const accId = typeof parsed.instagramAccountId === "string" ? parsed.instagramAccountId : "global";
  const targetId =
    (typeof parsed.userId === "string" && parsed.userId) ||
    (typeof parsed.commenterId === "string" && parsed.commenterId) ||
    (typeof parsed.recipientId === "string" && parsed.recipientId) ||
    (typeof parsed.senderId === "string" && parsed.senderId) ||
    null;

  if (!targetId) return null;
  return { accId, targetId };
}

export function getConversationLockKey(convKey: string): string {
  const hash = crypto.createHash("md5").update(convKey).digest("hex");
  return `openreply_c_${hash}`;
}

async function claimCandidateJob(
  cand: { id: string; payload: any; runAt: Date; createdAt: Date },
  client: any = prisma
): Promise<string | null> {
  const convParams = parseConversationParams(cand.payload);

  if (convParams && typeof client.$transaction === "function") {
    const { accId, targetId } = convParams;
    const convKey = `${accId}:${targetId}`;
    const lockName = getConversationLockKey(convKey);

    try {
      return await client.$transaction(async (tx: any) => {
        // 1. Non-blocking advisory lock on conversation (connection-pinned in tx)
        let acquired = 1;
        if (typeof tx.$queryRawUnsafe === "function") {
          const lockRes: any = await tx.$queryRawUnsafe(`SELECT GET_LOCK('${lockName}', 0) as acquired`);
          acquired = Number(lockRes?.[0]?.acquired);
        }
        if (acquired !== 1) {
          return null;
        }

        try {
          // 2. Check if another job of this conversation is already RUNNING
          const runningJobs: any = await tx.$queryRawUnsafe(`
            SELECT id FROM BackgroundJob
            WHERE status = 'RUNNING'
              AND id != '${cand.id}'
              AND (
                (JSON_UNQUOTE(JSON_EXTRACT(payload, '$.instagramAccountId')) = '${accId}' OR '${accId}' = 'global')
                AND (
                  JSON_UNQUOTE(JSON_EXTRACT(payload, '$.userId')) = '${targetId}'
                  OR JSON_UNQUOTE(JSON_EXTRACT(payload, '$.commenterId')) = '${targetId}'
                  OR JSON_UNQUOTE(JSON_EXTRACT(payload, '$.recipientId')) = '${targetId}'
                  OR JSON_UNQUOTE(JSON_EXTRACT(payload, '$.senderId')) = '${targetId}'
                )
              )
            LIMIT 1
          `);

          if (runningJobs && runningJobs.length > 0) {
            return null;
          }

          // 3. Strict deterministic ordering: runAt -> createdAt -> id
          const runAtIso = cand.runAt.toISOString();
          const createdAtIso = cand.createdAt.toISOString();

          const earlierJobs: any = await tx.$queryRawUnsafe(`
            SELECT id FROM BackgroundJob
            WHERE status = 'PENDING'
              AND id != '${cand.id}'
              AND (
                runAt < '${runAtIso}'
                OR (runAt = '${runAtIso}' AND createdAt < '${createdAtIso}')
                OR (runAt = '${runAtIso}' AND createdAt = '${createdAtIso}' AND id < '${cand.id}')
              )
              AND (
                (JSON_UNQUOTE(JSON_EXTRACT(payload, '$.instagramAccountId')) = '${accId}' OR '${accId}' = 'global')
                AND (
                  JSON_UNQUOTE(JSON_EXTRACT(payload, '$.userId')) = '${targetId}'
                  OR JSON_UNQUOTE(JSON_EXTRACT(payload, '$.commenterId')) = '${targetId}'
                  OR JSON_UNQUOTE(JSON_EXTRACT(payload, '$.recipientId')) = '${targetId}'
                  OR JSON_UNQUOTE(JSON_EXTRACT(payload, '$.senderId')) = '${targetId}'
                )
              )
            LIMIT 1
          `);

          if (earlierJobs && earlierJobs.length > 0) {
            return null;
          }

          // 4. Atomically update status to RUNNING
          const updated = await tx.$executeRawUnsafe(`
            UPDATE BackgroundJob
            SET status = 'RUNNING', lockedAt = NOW()
            WHERE id = '${cand.id}' AND status = 'PENDING'
          `);

          return Number(updated) > 0 ? cand.id : null;
        } finally {
          if (typeof tx.$queryRawUnsafe === "function") {
            try {
              await tx.$queryRawUnsafe(`SELECT RELEASE_LOCK('${lockName}')`);
            } catch {}
          }
        }
      });
    } catch {
      return null;
    }
  }

  // Fallback for non-conversation jobs or mock test environments
  try {
    const res = await client.backgroundJob.updateMany({
      where: { id: cand.id, status: "PENDING" },
      data: {
        status: "RUNNING",
        lockedAt: new Date(),
      },
    });
    return res.count > 0 ? cand.id : null;
  } catch {
    return null;
  }
}

/**
 * Dequeues a batch of pending jobs atomically WITHOUT interactive transactions.
 * Prevents P2028 transaction timeouts, handles stale locked job recovery,
 * and guarantees zero double-processing between concurrent workers.
 *
 * Enforces cross-worker conversation mutual exclusion: two workers will never
 * execute dependent jobs for the same conversation concurrently.
 */
export async function dequeueBatch(batchSize: number = 10, client: any = prisma) {
  const now = new Date();

  // 1. Recover stale running jobs periodically (max once per 60s)
  const nowMs = Date.now();
  if (nowMs - lastStaleRecoveryAt >= STALE_RECOVERY_INTERVAL_MS) {
    lastStaleRecoveryAt = nowMs;
    await recoverStaleJobs().catch(() => {});
  }

  // 2. Query currently RUNNING jobs to protect active conversations across all workers
  const activeRunningJobs = await client.backgroundJob.findMany({
    where: { status: "RUNNING" },
    select: { payload: true },
  });

  const lockedConversations = new Set<string>();
  for (const rj of activeRunningJobs) {
    const key = getConversationKey(rj.payload);
    if (key) lockedConversations.add(key);
  }

  // 3. Find pending candidate IDs due for processing in deterministic order
  const candidates = await client.backgroundJob.findMany({
    where: {
      status: "PENDING",
      runAt: { lte: now },
    },
    orderBy: [{ runAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    take: batchSize * 2, // Take larger window to allow skipping conversation-locked jobs
    select: { id: true, payload: true, runAt: true, createdAt: true },
  });

  if (candidates.length === 0) return [];

  // Filter out any candidate whose conversation is already RUNNING in another worker,
  // or was already selected in this same batch
  const candidateJobs: Array<{ id: string; payload: any; runAt: Date; createdAt: Date }> = [];
  for (const cand of candidates) {
    const convKey = getConversationKey(cand.payload);
    if (convKey && lockedConversations.has(convKey)) {
      // Dependent job is already running elsewhere — skip to preserve strict FIFO order
      continue;
    }
    if (convKey) lockedConversations.add(convKey);
    candidateJobs.push(cand);
    if (candidateJobs.length >= batchSize) break;
  }

  if (candidateJobs.length === 0) return [];

  // 4. Atomically claim candidate jobs via database-level check-and-set.
  // Each candidate claim statement atomically re-verifies that no other job of the
  // conversation is RUNNING and no earlier job is PENDING (retry leapfrog prevention).
  // Claim sequentially to eliminate intra-batch InnoDB lock contention and self-deadlocks.
  const claimedIds: string[] = [];
  for (const cand of candidateJobs) {
    try {
      const claimedId = await claimCandidateJob(cand, client);
      if (claimedId) {
        claimedIds.push(claimedId);
      }
    } catch {
      // On concurrent write conflict from another worker, skip and let next poll handle it
    }
  }
  if (claimedIds.length === 0) return [];

  // 5. Fetch full payload strictly for the jobs claimed by THIS worker in this call
  const jobs = await client.backgroundJob.findMany({
    where: {
      id: { in: claimedIds },
      status: "RUNNING",
    },
  });

  return jobs.map((job: any) => {
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
  await prisma.backgroundJob.updateMany({
    where: { id, status: "RUNNING" },
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
    await prisma.backgroundJob.updateMany({
      where: { id, status: "RUNNING" },
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
    await prisma.backgroundJob.updateMany({
      where: { id, status: "RUNNING" },
      data: {
        status: "FAILED",
        error,
        lockedAt: null,
        attempts: { increment: 1 },
      },
    });
  }
}



