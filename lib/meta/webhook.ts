import { createHmac, timingSafeEqual } from "crypto";

export function verifyWebhookSignature(
  payload: string,
  signature: string | null
): boolean {
  if (!signature) return false;

  const secrets = [
    process.env.FACEBOOK_APP_SECRET,
    process.env.INSTAGRAM_APP_SECRET,
  ].filter((s): s is string => Boolean(s));

  if (secrets.length === 0) {
    throw new Error(
      "FACEBOOK_APP_SECRET or INSTAGRAM_APP_SECRET is required to verify webhooks"
    );
  }

  return secrets.some((secret) => {
    const expected =
      "sha256=" + createHmac("sha256", secret).update(payload).digest("hex");
    try {
      return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  });
}

export interface WebhookCommentEvent {
  instagramAccountId: string;
  commentId: string;
  commentText: string;
  commenterId: string;
  commenterName?: string;
  mediaId: string;
}

export interface WebhookDirectMessageEvent {
  instagramAccountId: string;
  userId: string;
  username?: string;
  messageText: string;
  mid?: string;
  isStoryReply?: boolean;
  isStoryMention?: boolean;
  storyMediaId?: string;
  quickReplyPayload?: string;
}

export interface WebhookPostbackEvent {
  instagramAccountId: string;
  userId: string;
  payload: string;
  mid?: string;
}

export interface WebhookReactionEvent {
  instagramAccountId: string;
  userId: string;
  reaction: string;
  action: "react" | "unreact";
  mid?: string;
}

interface WebhookMessagingItem {
  sender?: { id?: string };
  recipient?: { id?: string };
  postback?: { mid?: string; title?: string; payload?: string };
  reaction?: { mid?: string; action?: "react" | "unreact"; reaction?: string; emoji?: string };
  message?: {
    mid?: string;
    text?: string;
    from?: { id?: string; username?: string };
    reply_to?: { mid?: string; story?: { id?: string; url?: string } };
    story_share?: any;
    quick_reply?: { payload?: string };
    attachments?: Array<{ type?: string; payload?: any }>;
  };
}

interface WebhookEntry {
  id: string;
  time: number;
  changes?: Array<{
    field: string;
    value: {
      id?: string;
      comment_id?: string;
      text?: string;
      from?: {
        id?: string;
        username?: string;
      };
      media?: {
        id?: string;
      };
      media_id?: string;
    };
  }>;
  messaging?: WebhookMessagingItem[];
}

interface WebhookPayload {
  object: string;
  entry: WebhookEntry[];
}

export function parseCommentEvents(payload: WebhookPayload): WebhookCommentEvent[] {
  const events: WebhookCommentEvent[] = [];

  if (payload.object !== "instagram") {
    return events;
  }

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "comments" && change.field !== "live_comments") continue;

      const value = change.value;
      const commentId = value?.id ?? value?.comment_id;
      const mediaId = value?.media?.id ?? value?.media_id;
      const commenterId = value?.from?.id;

      if (!entry.id || !commentId || !mediaId || !commenterId) {
        continue;
      }

      if (commenterId === entry.id) {
        continue;
      }

      events.push({
        instagramAccountId: entry.id,
        commentId,
        commentText: value.text ?? "",
        commenterId,
        commenterName: value.from?.username,
        mediaId,
      });
    }
  }

  return events;
}

export function parseDirectMessageEvents(
  payload: WebhookPayload
): WebhookDirectMessageEvent[] {
  const events: WebhookDirectMessageEvent[] = [];

  if (payload.object !== "instagram") return events;

  for (const entry of payload.entry ?? []) {
    const accountId = entry.id;
    if (!accountId) continue;

    for (const messaging of entry.messaging ?? []) {
      const senderId = messaging.sender?.id;
      const message = messaging.message;

      if (!senderId || senderId === accountId || !message || messaging.postback) {
        continue;
      }

      const text = message.text ?? "";
      const isStoryReply = Boolean(message.reply_to?.story || message.story_share);
      const isStoryMention = Boolean(
        message.attachments?.some((att) => att.type === "story_mention")
      );
      const quickReplyPayload = message.quick_reply?.payload;

      events.push({
        instagramAccountId: accountId,
        userId: senderId,
        username: message.from?.username,
        messageText: text,
        mid: message.mid,
        isStoryReply,
        isStoryMention,
        storyMediaId: message.reply_to?.story?.id,
        quickReplyPayload,
      });
    }

    for (const change of entry.changes ?? []) {
      if (change.field !== "mentions" && change.field !== "story_mention") continue;

      const value = change.value;
      const senderId = value?.from?.id;
      if (!senderId || senderId === accountId) continue;

      events.push({
        instagramAccountId: accountId,
        userId: senderId,
        username: value?.from?.username,
        messageText: value?.text ?? "Story Mention",
        isStoryMention: true,
        storyMediaId: value?.media_id ?? value?.id,
      });
    }
  }

  return events;
}

export function parsePostbackEvents(
  payload: WebhookPayload
): WebhookPostbackEvent[] {
  const events: WebhookPostbackEvent[] = [];

  if (payload.object !== "instagram") return events;

  for (const entry of payload.entry ?? []) {
    for (const messaging of entry.messaging ?? []) {
      const postbackPayload = messaging.postback?.payload || messaging.message?.quick_reply?.payload;
      const userId = messaging.sender?.id;
      const accountId = entry.id ?? messaging.recipient?.id;

      if (!postbackPayload || !userId || !accountId) continue;
      if (userId === accountId) continue;

      events.push({
        instagramAccountId: accountId,
        userId,
        payload: postbackPayload,
        mid: messaging.postback?.mid || messaging.message?.mid,
      });
    }
  }

  return events;
}

export function parseReactionEvents(
  payload: WebhookPayload
): WebhookReactionEvent[] {
  const events: WebhookReactionEvent[] = [];

  if (payload.object !== "instagram") return events;

  for (const entry of payload.entry ?? []) {
    const accountId = entry.id;
    if (!accountId) continue;

    for (const messaging of entry.messaging ?? []) {
      const reaction = messaging.reaction;
      const userId = messaging.sender?.id;

      if (!reaction || !userId || userId === accountId) continue;

      events.push({
        instagramAccountId: accountId,
        userId,
        reaction: reaction.reaction || reaction.emoji || "❤️",
        action: reaction.action || "react",
        mid: reaction.mid,
      });
    }
  }

  return events;
}
