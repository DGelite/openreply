/**
 * OpenReply Zero-Lead-Loss Reconciliation Engine
 * Automatically audits Instagram comments against BoxAPI Data API and Official API.
 * Detects missed leads during server downtime, network latency, or webhook failures,
 * ledgering recovered events and enqueueing them for immediate processing.
 */

import { prisma } from "@/lib/db/client";
import { enqueueJob } from "@/lib/queue/mysql-queue";
import { BoxApiClient } from "@/lib/providers/boxapi/boxapi-client";
import crypto from "crypto";

export interface ReconciliationResult {
  accountId: string;
  postId: string;
  scannedCount: number;
  recoveredCount: number;
  status: "SUCCESS" | "SKIPPED" | "FAILED";
  error?: string;
}

export interface ReconcileAllReport {
  scannedPosts: number;
  totalCommentsScanned: number;
  totalLeadsRecovered: number;
  results: ReconciliationResult[];
}

/**
 * Reconciles comments for a single account and Instagram post.
 */
export async function reconcileAccountPostComments(
  accountId: string,
  postId: string
): Promise<ReconciliationResult> {
  const account = await prisma.instagramAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    return {
      accountId,
      postId,
      scannedCount: 0,
      recoveredCount: 0,
      status: "FAILED",
      error: "InstagramAccount not found",
    };
  }

  // BoxAPI credentials required for recovery
  const apiKey = account.boxApiKey || process.env.BOXAPI_API_KEY || "";
  const boxAccountId = account.boxAccountId || process.env.BOXAPI_ACCOUNT_ID || undefined;
  const dataToken = account.boxApiToken || process.env.BOXAPI_DATA_TOKEN || undefined;

  if (!apiKey && !dataToken) {
    return {
      accountId,
      postId,
      scannedCount: 0,
      recoveredCount: 0,
      status: "SKIPPED",
      error: "No BoxAPI credentials configured on account for zero-lead-loss reconciliation",
    };
  }

  const boxClient = new BoxApiClient({
    apiKey,
    accountId: boxAccountId,
    apiToken: dataToken,
  });

  let rawComments: any[] = [];

  try {
    // 1. Attempt retrieval via Data API (does not require page tokens or webhooks)
    if (dataToken) {
      try {
        const dataRes = await boxClient.dataPost<{
          comments?: any[];
          data?: { comments?: any[] };
        }>("media/get_comments", { id: postId });

        rawComments = dataRes.data?.comments || (dataRes as any).comments || [];
      } catch (dataErr) {
        console.warn(
          `[Reconciliation] Data API failed for post ${postId}, falling back to Official API:`,
          dataErr instanceof Error ? dataErr.message : dataErr
        );
      }
    }

    // 2. Fallback to Official API if Data API was unavailable or returned empty
    if (rawComments.length === 0 && apiKey && boxAccountId) {
      const officialRes = await boxClient.officialPost<{
        comments?: any[];
        data?: any[];
      }>("/service/actions/get_comments", { post_id: postId });

      if (Array.isArray(officialRes.data)) {
        rawComments = officialRes.data;
      } else if (officialRes.data && Array.isArray((officialRes.data as any).comments)) {
        rawComments = (officialRes.data as any).comments;
      } else {
        rawComments = [];
      }
    }
  } catch (apiErr) {
    const errorMsg = apiErr instanceof Error ? apiErr.message : String(apiErr);
    console.error(`[Reconciliation] Error querying BoxAPI for post ${postId}:`, errorMsg);
    return {
      accountId,
      postId,
      scannedCount: 0,
      recoveredCount: 0,
      status: "FAILED",
      error: errorMsg,
    };
  }

  let recoveredCount = 0;

  for (const comment of rawComments) {
    const commentId = String(comment.id || comment.comment_id || "");
    if (!commentId) continue;

    const commenterId = String(
      comment.user?.id || comment.from?.id || comment.user_id || comment.sender_id || ""
    );
    const commenterUsername =
      comment.user?.username || comment.from?.username || comment.username || "user";
    const commentText = comment.text || comment.message || "";

    const idempotencyKey = `BOXAPI_${account.id}_${commentId}`;

    // Check if event already exists in InboundEventLedger
    const existingInLedger = await prisma.inboundEventLedger.findUnique({
      where: { idempotencyKey },
    });

    if (existingInLedger) {
      continue;
    }

    // Check if already processed in DmLog
    const existingInDmLog = await prisma.dmLog.findFirst({
      where: { commentId },
    });

    if (existingInDmLog) {
      continue;
    }

    // Missed comment detected! Ledger and recover immediately.
    await prisma.inboundEventLedger.create({
      data: {
        idempotencyKey,
        provider: "BOXAPI",
        accountId: account.id,
        eventType: "COMMENT",
        rawPayload: comment as any,
        source: "RECONCILIATION_WORKER",
        processed: true,
        processedAt: new Date(),
      },
    });

    // Enqueue comment for automation matching
    await enqueueJob("process-comment", {
      instagramAccountId: account.instagramId,
      commentId,
      commentText,
      commenterId: commenterId || "unknown",
      commenterName: commenterUsername,
      mediaId: postId,
    });

    recoveredCount++;
  }

  // Update ReconciliationCheckpoint
  await prisma.reconciliationCheckpoint.upsert({
    where: {
      instagramAccountId_postId: {
        instagramAccountId: account.id,
        postId,
      },
    },
    create: {
      instagramAccountId: account.id,
      postId,
      scannedCount: rawComments.length,
      recoveredCount,
      lastScannedAt: new Date(),
      lastCommentId: rawComments[0]?.id ? String(rawComments[0].id) : null,
    },
    update: {
      scannedCount: { increment: rawComments.length },
      recoveredCount: { increment: recoveredCount },
      lastScannedAt: new Date(),
      lastCommentId: rawComments[0]?.id ? String(rawComments[0].id) : undefined,
    },
  });

  return {
    accountId,
    postId,
    scannedCount: rawComments.length,
    recoveredCount,
    status: "SUCCESS",
  };
}

/**
 * Sweeps all active automations across all connected Instagram accounts.
 * Safe to run as a cron job or background worker.
 */
export async function reconcileAllActiveAutomations(): Promise<ReconcileAllReport> {
  const activeAutomations = await prisma.automation.findMany({
    where: {
      isActive: true,
      postId: { not: null },
    },
    select: {
      instagramAccountId: true,
      postId: true,
    },
  });

  const uniquePairs = new Map<string, { accountId: string; postId: string }>();
  for (const auto of activeAutomations) {
    if (auto.postId) {
      const key = `${auto.instagramAccountId}:${auto.postId}`;
      uniquePairs.set(key, { accountId: auto.instagramAccountId, postId: auto.postId });
    }
  }

  const results: ReconciliationResult[] = [];
  let totalCommentsScanned = 0;
  let totalLeadsRecovered = 0;

  for (const pair of uniquePairs.values()) {
    try {
      const result = await reconcileAccountPostComments(pair.accountId, pair.postId);
      results.push(result);
      totalCommentsScanned += result.scannedCount;
      totalLeadsRecovered += result.recoveredCount;
    } catch (err) {
      results.push({
        accountId: pair.accountId,
        postId: pair.postId,
        scannedCount: 0,
        recoveredCount: 0,
        status: "FAILED",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    scannedPosts: uniquePairs.size,
    totalCommentsScanned,
    totalLeadsRecovered,
    results,
  };
}
