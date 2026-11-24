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
  const p = payload as any;

  const isCommentEvent =
    p.event_type === 'comment' ||
    p.event_type === 'comments' ||
    (!p.event_type && (p.media || p.text !== undefined) && p.from);

  if (!isCommentEvent) {
    return [];
  }

  const data = p.data || p;
  if (!data || !data.id) {
    return [];
  }

  return [
    {
      boxAccountId: p.account_id || '',
      commentId: String(data.id),
      commentText: data.text || '',
      commenterId: String(data.from?.id || 'unknown'),
      commenterName: data.from?.username,
      mediaId: String(data.media?.id || 'unknown'),
      eventId: p.event_id,
    },
  ];
}

export function parseBoxApiDirectMessageEvents(payload: unknown): ParsedBoxApiDm[] {
  if (!payload || typeof payload !== 'object') return [];
  const p = payload as any;

  const isDmEvent =
    p.event_type === 'messaging' ||
    p.event_type === 'message' ||
    p.event_type === 'messaging_quick_replies' ||
    p.event_type === 'messages' ||
    (!p.event_type && (p.message || p.messaging));

  if (!isDmEvent) {
    return [];
  }

  const data = p.data || p;

  if (Array.isArray(data?.messaging)) {
    return data.messaging
      .filter((m: any) => m.message && !m.message.is_echo)
      .map((m: any) => ({
        boxAccountId: p.account_id || '',
        userId: String(m.sender?.id || 'unknown'),
        messageText: m.message.text || '',
        mid: m.message.mid || `box_mid_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        quickReplyPayload: m.message.quick_reply?.payload,
        isEcho: Boolean(m.message.is_echo),
        eventId: p.event_id,
      }));
  }

  if (data?.message) {
    if (data.message.is_echo) return [];
    return [
      {
        boxAccountId: p.account_id || '',
        userId: String(data.sender?.id || 'unknown'),
        messageText: data.message.text || '',
        mid: data.message.mid || `box_mid_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        quickReplyPayload: data.message.quick_reply?.payload,
        isEcho: Boolean(data.message.is_echo),
        eventId: p.event_id,
      },
    ];
  }

  return [];
}

export function parseBoxApiPostbackEvents(payload: unknown): ParsedBoxApiPostback[] {
  if (!payload || typeof payload !== 'object') return [];
  const p = payload as any;

  const isPostbackEvent =
    p.event_type === 'messaging' ||
    p.event_type === 'messaging_postbacks' ||
    p.event_type === 'postback';

  if (!isPostbackEvent || !p.data) {
    return [];
  }

  if (Array.isArray(p.data?.messaging)) {
    return p.data.messaging
      .filter((m: any) => Boolean(m.postback))
      .map((m: any) => ({
        boxAccountId: p.account_id || '',
        userId: String(m.sender?.id || 'unknown'),
        payload: m.postback.payload || '',
        mid: m.postback.mid,
        eventId: p.event_id,
      }));
  }

  if (!p.data.postback) {
    return [];
  }

  return [
    {
      boxAccountId: p.account_id || '',
      userId: String(p.data.sender?.id || 'unknown'),
      payload: p.data.postback.payload || '',
      mid: p.data.postback.mid,
      eventId: p.event_id,
    },
  ];
}
