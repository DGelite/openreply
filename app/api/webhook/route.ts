import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { enqueueJob, enqueueJobsBatch, POSTBACK_JOB_NAME } from "@/lib/queue/mysql-queue";
import {
  parseCommentEvents,
  parseDirectMessageEvents,
  parsePostbackEvents,
  parseReactionEvents,
  verifyWebhookSignature,
} from "@/lib/meta/webhook";
import { Prisma } from "@/lib/generated/prisma/client";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json(
    { success: false, error: "Verification failed" },
    { status: 403 }
  );
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  // ── Signature verification (fast path) ──────────────────────────────────
  if (!verifyWebhookSignature(rawBody, signature)) {
    // Log asynchronously — never block the response on this
    prisma.operationalEvent
      .create({
        data: {
          source: "SYSTEM",
          level: "WARNING",
          message: "Webhook signature verification failed",
          payload: {
            hadSignatureHeader: Boolean(signature),
            bodyLength: rawBody.length,
            bodyPreview: rawBody.slice(0, 200),
          },
        },
      })
      .catch(() => {});

    return NextResponse.json(
      { success: false, error: "Invalid signature" },
      { status: 401 }
    );
  }

  // ── Parse JSON (fast path) ───────────────────────────────────────────────
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  // ── Durably enqueue all work with 3.5s timeout guard ─────────────────────
  // Meta Graph API v25.0 requires a 200 response within 5 seconds.
  // We await fast queue persistence (~20ms) to guarantee durability before acknowledging Meta.
  // A 3.5s timeout guard guarantees we never breach Meta's 5s retry window.
  try {
    await Promise.race([
      enqueueAllWebhookWork(payload, rawBody.length),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Webhook enqueue timeout (3.5s)")), 3500)
      ),
    ]);
  } catch (enqueueErr) {
    console.error(
      "[Webhook] Enqueue error or timeout:",
      enqueueErr instanceof Error ? enqueueErr.message : enqueueErr
    );
    // If database was down, returning 500 triggers Meta retry policy
    // If it was just a timeout, we still return 200 to prevent retry storm
    if (enqueueErr instanceof Error && !enqueueErr.message.includes("timeout")) {
      return NextResponse.json(
        { success: false, error: "Database unavailable" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ success: true }, { status: 200 });
}

const accountWorkspaceCache = new Map<string, { workspaceId: string; expiresAt: number }>();
const ACC_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ACC_CACHE_SIZE = 200;

function linkWebhookToWorkspace(webhookEventId: string, instagramAccountId: string) {
  const now = Date.now();
  const cached = accountWorkspaceCache.get(instagramAccountId);
  if (cached && now < cached.expiresAt) {
    prisma.webhookEvent
      .update({
        where: { id: webhookEventId },
        data: { workspaceId: cached.workspaceId },
      })
      .catch(() => {});
    return;
  }

  prisma.instagramAccount
    .findUnique({
      where: { instagramId: instagramAccountId },
      select: { workspaceId: true },
    })
    .then((account) => {
      if (account) {
        if (accountWorkspaceCache.size >= MAX_ACC_CACHE_SIZE) {
          const oldest = accountWorkspaceCache.keys().next().value;
          if (oldest) accountWorkspaceCache.delete(oldest);
        }
        accountWorkspaceCache.set(instagramAccountId, {
          workspaceId: account.workspaceId,
          expiresAt: now + ACC_CACHE_TTL_MS,
        });
        return prisma.webhookEvent.update({
          where: { id: webhookEventId },
          data: { workspaceId: account.workspaceId },
        });
      }
    })
    .catch(() => {});
}

/**
 * Enqueue all comment/DM/postback events from a single webhook payload.
 * Called asynchronously after we've already responded 200 to Meta.
 */
async function enqueueAllWebhookWork(payload: unknown, bodyLength: number): Promise<void> {
  // Create the webhook event record for audit/tracing
  let webhookEventId: string | null = null;
  try {
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        object:
          typeof payload === "object" && payload && "object" in payload
            ? String((payload as any).object)
            : null,
        payload: payload as Prisma.InputJsonValue,
        status: "PENDING",
      },
    });
    webhookEventId = webhookEvent.id;
  } catch {
    // Non-fatal — event logging should never block processing
  }

  let hadError = false;

  try {
    // ── 1. Comment events ──────────────────────────────────────────────────
    const commentEvents = parseCommentEvents(
      payload as Parameters<typeof parseCommentEvents>[0]
    );

    const commentJobs: Array<{ name: string; payload: any }> = [];
    for (const event of commentEvents) {
      try {
        await prisma.processedComment.create({
          data: {
            instagramAccountId: event.instagramAccountId,
            commentId: event.commentId,
            source: "WEBHOOK",
          },
        });
        commentJobs.push({
          name: "process-comment",
          payload: {
            instagramAccountId: event.instagramAccountId,
            commentId: event.commentId,
            commentText: event.commentText,
            commenterId: event.commenterId,
            commenterName: event.commenterName,
            mediaId: event.mediaId,
            source: "WEBHOOK" as const,
          },
        });
      } catch {
        console.warn(`[Webhook] Duplicate comment ${event.commentId} detected. Skipping.`);
        continue;
      }
    }

    if (commentJobs.length > 0) {
      await enqueueJobsBatch(commentJobs);
    }

    // Link webhook event to workspace once per payload using cached account lookup
    const primaryAccountId = commentEvents[0]?.instagramAccountId;
    if (webhookEventId && primaryAccountId) {
      linkWebhookToWorkspace(webhookEventId, primaryAccountId);
    }

    // ── 2. Postback events (button taps → reveal DM) ───────────────────────
    const postbackEvents = parsePostbackEvents(
      payload as Parameters<typeof parsePostbackEvents>[0]
    );

    const postbackJobs: Array<{ name: string; payload: any }> = [];
    for (const event of postbackEvents) {
      if (event.mid) {
        try {
          await prisma.processedMessage.create({
            data: {
              instagramAccountId: event.instagramAccountId,
              mid: event.mid,
              source: "WEBHOOK",
            },
          });
        } catch {
          console.warn(`[Webhook] Duplicate postback mid ${event.mid} detected. Skipping.`);
          continue;
        }
      }

      postbackJobs.push({
        name: POSTBACK_JOB_NAME,
        payload: {
          instagramAccountId: event.instagramAccountId,
          userId: event.userId,
          payload: event.payload,
          mid: event.mid,
        },
      });
    }

    if (postbackJobs.length > 0) {
      await enqueueJobsBatch(postbackJobs);
    }

    // ── 3. Direct Messages, Story Replies & Story Mentions ─────────────────
    const dmEvents = parseDirectMessageEvents(
      payload as Parameters<typeof parseDirectMessageEvents>[0]
    );

    const dmJobs: Array<{ name: string; payload: any }> = [];
    for (const event of dmEvents) {
      if (event.mid) {
        try {
          await prisma.processedMessage.create({
            data: {
              instagramAccountId: event.instagramAccountId,
              mid: event.mid,
              source: "WEBHOOK",
            },
          });
        } catch {
          console.warn(`[Webhook] Duplicate DM mid ${event.mid} detected. Skipping.`);
          continue;
        }
      }

      dmJobs.push({
        name: "process-dm",
        payload: {
          instagramAccountId: event.instagramAccountId,
          userId: event.userId,
          username: event.username,
          messageText: event.messageText,
          mid: event.mid,
          isStoryReply: event.isStoryReply,
          isStoryMention: event.isStoryMention,
          storyMediaId: event.storyMediaId,
          quickReplyPayload: event.quickReplyPayload,
        },
      });
    }

    if (dmJobs.length > 0) {
      await enqueueJobsBatch(dmJobs);
    }

    // ── 4. Story Reactions (e.g. Heart / Emoji reaction to Stories) ─────────
    const reactionEvents = parseReactionEvents(
      payload as Parameters<typeof parseReactionEvents>[0]
    );

    const reactionJobs: Array<{ name: string; payload: any }> = [];
    for (const event of reactionEvents) {
      if (event.mid) {
        try {
          await prisma.processedMessage.create({
            data: {
              instagramAccountId: event.instagramAccountId,
              mid: event.mid,
              source: "WEBHOOK",
            },
          });
        } catch {
          continue;
        }
      }

      reactionJobs.push({
        name: "process-reaction",
        payload: {
          instagramAccountId: event.instagramAccountId,
          userId: event.userId,
          messageText: event.reaction,
          mid: event.mid,
          isStoryReaction: true,
        },
      });
    }

    if (reactionJobs.length > 0) {
      await enqueueJobsBatch(reactionJobs);
    }

    // ── Mark webhook event processed ───────────────────────────────────────
    if (webhookEventId) {
      await prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: {
          status: "PROCESSED",
          processedAt: new Date(),
        },
      });
    }
  } catch (error) {
    hadError = true;
    const message = error instanceof Error ? error.message : "Unknown error";
    if (webhookEventId) {
      await prisma.webhookEvent
        .update({
          where: { id: webhookEventId },
          data: {
            status: "FAILED",
            errorMessage: message,
            processedAt: new Date(),
          },
        })
        .catch(() => {});
    }
    throw error;
  }
}
