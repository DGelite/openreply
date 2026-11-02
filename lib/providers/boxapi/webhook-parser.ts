/**
 * BoxAPI Webhook Parser
 * Converts incoming BoxAPI webhook payloads into standardized OpenReply internal event structures.
 */

export interface BoxApiRawCommentPayload {
  event_id?: string;
  event_type: 'comment';
  account_id: string;
  data: {
    id: string;
    media?: { id?: string; media_product_type?: string };
    from?: { id?: string; username?: string };
    text: string;
    parent_id?: string | null;
    created_at?: number;
  };
}

export interface BoxApiRawMessagingPayload {
  event_id?: string;
  event_type: 'messaging';
  account_id: string;
  data: {
    sender: { id: string };
    recipient: { id: string };
    timestamp?: number;
    message?: {
      mid: string;
      text?: string;
      is_echo?: boolean;
      quick_reply?: { payload: string };
      attachments?: Array<{ type: string; payload?: { url?: string } }>;
    };
    postback?: {
      mid?: string;
      title?: string;
      payload: string;
    };
  };
}

export type BoxApiRawPayload =
  | BoxApiRawCommentPayload
  | BoxApiRawMessagingPayload
  | Record<string, unknown>;

export interface ParsedBoxApiComment {
  boxAccountId: string;
  commentId: string;
  commentText: string;
  commenterId: string;
  commenterName?: string;
  mediaId: string;
  eventId?: string;
}

export interface ParsedBoxApiDm {
  boxAccountId: string;
  userId: string;
  messageText: string;
  mid: string;
  quickReplyPayload?: string;
  isEcho?: boolean;
  eventId?: string;
}

export interface ParsedBoxApiPostback {
  boxAccountId: string;
  userId: string;
  payload: string;
  mid?: string;
  eventId?: string;
}

export function parseBoxApiCommentEvents(payload: unknown): ParsedBoxApiComment[] {
  if (!payload || typeof payload !== 'object') return [];
  const p = payload as BoxApiRawCommentPayload;

  if (p.event_type !== 'comment' || !p.data || !p.data.id) {
    return [];
  }

  return [
    {
      boxAccountId: p.account_id,
      commentId: String(p.data.id),
      commentText: p.data.text || '',
      commenterId: String(p.data.from?.id || 'unknown'),
      commenterName: p.data.from?.username,
      mediaId: String(p.data.media?.id || 'unknown'),
      eventId: p.event_id,
    },
  ];
}

export function parseBoxApiDirectMessageEvents(payload: unknown): ParsedBoxApiDm[] {
  if (!payload || typeof payload !== 'object') return [];
  const p = payload as BoxApiRawMessagingPayload;

  if (p.event_type !== 'messaging' || !p.data || !p.data.message) {
    return [];
  }

  // Skip echo messages (messages sent by the page itself)
  if (p.data.message.is_echo) {
    return [];
  }

  return [
    {
      boxAccountId: p.account_id,
      userId: String(p.data.sender?.id || 'unknown'),
      messageText: p.data.message.text || '',
      mid: p.data.message.mid || `box_mid_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      quickReplyPayload: p.data.message.quick_reply?.payload,
      isEcho: Boolean(p.data.message.is_echo),
      eventId: p.event_id,
    },
  ];
}

export function parseBoxApiPostbackEvents(payload: unknown): ParsedBoxApiPostback[] {
  if (!payload || typeof payload !== 'object') return [];
  const p = payload as BoxApiRawMessagingPayload;

  if (p.event_type !== 'messaging' || !p.data || !p.data.postback) {
    return [];
  }

  return [
    {
      boxAccountId: p.account_id,
      userId: String(p.data.sender?.id || 'unknown'),
      payload: p.data.postback.payload || '',
      mid: p.data.postback.mid,
      eventId: p.event_id,
    },
  ];
}
