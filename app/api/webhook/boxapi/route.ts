import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db/client';
import { enqueueJobsBatch, POSTBACK_JOB_NAME } from '@/lib/queue/mysql-queue';
import { verifyBoxApiWebhookSignature } from '@/lib/providers/boxapi/webhook-verifier';
import {
  parseBoxApiCommentEvents,
  parseBoxApiDirectMessageEvents,
  parseBoxApiPostbackEvents,
} from '@/lib/providers/boxapi/webhook-parser';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const challenge = searchParams.get('challenge') || searchParams.get('hub.challenge');
  const token = searchParams.get('token') || searchParams.get('hub.verify_token');

  const expectedToken = process.env.BOXAPI_WEBHOOK_VERIFY_TOKEN || process.env.WEBHOOK_VERIFY_TOKEN;
  if (token && token === expectedToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ success: true, service: 'BoxAPI Webhook Endpoint' }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-boxapi-signature') || request.headers.get('x-hub-signature-256');
  const timestamp = request.headers.get('x-boxapi-timestamp');

  // Fast JSON parse
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const boxAccountId = payload.account_id;

  // Account lookup
  let account = null;
  if (boxAccountId) {
    account = await prisma.instagramAccount.findFirst({
      where: {
        OR: [
          { boxAccountId: boxAccountId },
          { instagramId: boxAccountId },
        ],
      },
      select: {
        id: true,
        instagramId: true,
        workspaceId: true,
        boxWebhookSecret: true,
      },
    });
  }

  const webhookSecret =
    account?.boxWebhookSecret ||
    process.env.BOXAPI_WEBHOOK_SECRET ||
    process.env.WEBHOOK_VERIFY_TOKEN ||
    '';

  // Signature verification (if secret configured)
  if (webhookSecret && signature) {
    const verification = verifyBoxApiWebhookSignature(
      rawBody,
      signature,
      timestamp,
      webhookSecret
    );

    if (!verification.isValid) {
      console.warn(`[BoxApiWebhook] Signature verification failed: ${verification.error}`);
      return NextResponse.json({ success: false, error: 'Invalid signature' }, { status: 401 });
    }
  }

  // Durably enqueue with 3.5s timeout guard
  try {
    await Promise.race([
      processAndEnqueueBoxApiPayload(payload, account),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('BoxAPI Webhook enqueue timeout (3.5s)')), 3500)
      ),
    ]);
  } catch (err: unknown) {
    console.error('[BoxApiWebhook] Enqueue error or timeout:', (err as Error)?.message || err);
    return NextResponse.json({ success: false, error: 'Enqueue timeout' }, { status: 500 });
  }

  return NextResponse.json({ success: true, provider: 'BOXAPI' }, { status: 200 });
}

async function processAndEnqueueBoxApiPayload(
  payload: any,
  account: { id: string; instagramId: string; workspaceId: string } | null
): Promise<void> {
  const targetAccountId = account?.id || payload.account_id || 'unknown';
  const targetInstagramId = account?.instagramId || payload.account_id || 'unknown';

  // ── 1. Inbound Event Ledger Persistence & Deduplication ───────────────────
  const eventId =
    payload.event_id ||
    crypto
      .createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex')
      .substring(0, 32);

  const idempotencyKey = `BOXAPI_${targetAccountId}_${eventId}`;

  try {
    await prisma.inboundEventLedger.create({
      data: {
        idempotencyKey,
        provider: 'BOXAPI',
        accountId: targetAccountId,
        eventType: payload.event_type || 'UNKNOWN',
        rawPayload: payload,
        source: 'WEBHOOK_BOXAPI',
      },
    });
  } catch {
    console.warn(`[BoxApiWebhook] Duplicate event ${idempotencyKey} already in ledger. Skipping.`);
    return;
  }

  // ── 2. Parse & Enqueue Comment Events ─────────────────────────────────────
  const comments = parseBoxApiCommentEvents(payload);
  const commentJobs: Array<{ name: string; payload: any }> = [];

  for (const c of comments) {
    try {
      await prisma.processedComment.create({
        data: {
          instagramAccountId: targetInstagramId,
          commentId: c.commentId,
          source: 'WEBHOOK',
        },
      });

      commentJobs.push({
        name: 'process-comment',
        payload: {
          instagramAccountId: targetInstagramId,
          commentId: c.commentId,
          commentText: c.commentText,
          commenterId: c.commenterId,
          commenterName: c.commenterName,
          mediaId: c.mediaId,
          source: 'WEBHOOK' as const,
        },
      });
    } catch {
      console.warn(`[BoxApiWebhook] Comment ${c.commentId} already processed. Skipping.`);
    }
  }

  if (commentJobs.length > 0) {
    await enqueueJobsBatch(commentJobs);
  }

  // ── 3. Parse & Enqueue Direct Message Events ──────────────────────────────
  const dms = parseBoxApiDirectMessageEvents(payload);
  const dmJobs: Array<{ name: string; payload: any }> = [];

  for (const dm of dms) {
    try {
      await prisma.processedMessage.create({
        data: {
          instagramAccountId: targetInstagramId,
          mid: dm.mid,
          source: 'WEBHOOK',
        },
      });

      dmJobs.push({
        name: 'process-dm',
        payload: {
          instagramAccountId: targetInstagramId,
          userId: dm.userId,
          messageText: dm.messageText,
          mid: dm.mid,
          quickReplyPayload: dm.quickReplyPayload,
        },
      });
    } catch {
      console.warn(`[BoxApiWebhook] DM ${dm.mid} already processed. Skipping.`);
    }
  }

  if (dmJobs.length > 0) {
    await enqueueJobsBatch(dmJobs);
  }

  // ── 4. Parse & Enqueue Postback Events ────────────────────────────────────
  const postbacks = parseBoxApiPostbackEvents(payload);
  const postbackJobs: Array<{ name: string; payload: any }> = [];

  for (const pb of postbacks) {
    if (pb.mid) {
      try {
        await prisma.processedMessage.create({
          data: {
            instagramAccountId: targetInstagramId,
            mid: pb.mid,
            source: 'WEBHOOK',
          },
        });
      } catch {
        continue;
      }
    }

    postbackJobs.push({
      name: POSTBACK_JOB_NAME,
      payload: {
        instagramAccountId: targetInstagramId,
        userId: pb.userId,
        payload: pb.payload,
        mid: pb.mid,
      },
    });
  }

  if (postbackJobs.length > 0) {
    await enqueueJobsBatch(postbackJobs);
  }
}
