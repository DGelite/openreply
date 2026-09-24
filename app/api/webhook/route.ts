import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { enqueueJob, POSTBACK_JOB_NAME } from "@/lib/queue/mysql-queue";
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

  // ── Return 200 IMMEDIATELY then enqueue all work asynchronously ──────────
  // Meta Graph API v25.0 requires a 200 response within 5 seconds.
  // Any synchronous processing here risks webhook retry storms.
  // All comment/DM/postback processing is handed off to the background worker.

  // Fire-and-forget: enqueue everything, don't await results before returning
  setImmediate(() => {
    enqueueAllWebhookWork(payload, rawBody.length).catch((err) => {
      console.error("[Webhook] Background enqueue failed:", err instanceof Error ? err.message : err);
    });
  });

  return NextResponse.json({ success: true }, { status: 200 });
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

    for (const event of commentEvents) {
      try {
        await prisma.processedComment.create({
          data: {
            instagramAccountId: event.instagramAccountId,
            commentId: event.commentId,
            source: "WEBHOOK",
          },
        });
      } catch {
        console.warn(`[Webhook] Duplicate comment ${event.commentId} detected. Skipping.`);
        continue;
      }

      await enqueueJob("process-comment", {
        instagramAccountId: event.instagramAccountId,
        commentId: event.commentId,
        commentText: event.commentText,
        commenterId: event.commenterId,
        commenterName: event.commenterName,
        mediaId: event.mediaId,
        source: "WEBHOOK" as const,
      });

      // Asynchronously link webhook event to workspace (non-blocking)
      if (webhookEventId) {
        prisma.instagramAccount
          .findUnique({
            where: { instagramId: event.instagramAccountId },
            select: { workspaceId: true },
          })
          .then((account) => {
            if (account && webhookEventId) {
              return prisma.webhookEvent.update({
                where: { id: webhookEventId },
                data: { workspaceId: account.workspaceId },
              });
            }
          })
          .catch(() => {});
      }
    }

    // ── 2. Postback events (button taps → reveal DM) ───────────────────────
    const postbackEvents = parsePostbackEvents(
      payload as Parameters<typeof parsePostbackEvents>[0]
    );

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

      await enqueueJob(POSTBACK_JOB_NAME, {
        instagramAccountId: event.instagramAccountId,
        userId: event.userId,
        payload: event.payload,
        mid: event.mid,
      });
    }

    // ── 3. Direct Messages, Story Replies & Story Mentions ─────────────────
    const dmEvents = parseDirectMessageEvents(
      payload as Parameters<typeof parseDirectMessageEvents>[0]
    );

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

      await enqueueJob("process-dm", {
        instagramAccountId: event.instagramAccountId,
        userId: event.userId,
        username: event.username,
        messageText: event.messageText,
        mid: event.mid,
        isStoryReply: event.isStoryReply,
        isStoryMention: event.isStoryMention,
        storyMediaId: event.storyMediaId,
        quickReplyPayload: event.quickReplyPayload,
      });
    }

    // ── 4. Story Reactions (e.g. Heart / Emoji reaction to Stories) ─────────
    const reactionEvents = parseReactionEvents(
      payload as Parameters<typeof parseReactionEvents>[0]
    );

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

      await enqueueJob("process-reaction", {
        instagramAccountId: event.instagramAccountId,
        userId: event.userId,
        messageText: event.reaction,
        mid: event.mid,
        isStoryReaction: true,
      });
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
