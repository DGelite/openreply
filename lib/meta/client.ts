import { getMetaGraphApiVersion, requireEnv } from "@/lib/env";

function instagramGraphBase() {
  return `https://graph.instagram.com/${getMetaGraphApiVersion()}`;
}

function facebookGraphBase() {
  return `https://graph.facebook.com/${getMetaGraphApiVersion()}`;
}

// Re-export error classes, types, and rate limiter utilities for 100% backward compatibility
export {
  MetaApiError,
  TokenExpiredError,
  RateLimitError,
  PermissionError,
  PolicyBlockError,
  MessagingWindowExpiredError,
  CommentAlreadyRepliedError,
  UserUnreachableError,
} from "./errors";

export type {
  GraphApiError,
  InstagramUser,
  InstagramComment,
  InstagramMedia,
  InstagramMediaInsights,
  TokenResponse,
  MediaType,
  MetaButton,
  GenericTemplateElement,
  QuickReplyOption,
} from "./types";

export {
  APP_USAGE_WARN_THRESHOLD,
  APP_USAGE_DANGER_THRESHOLD,
  APP_USAGE_CRITICAL_THRESHOLD,
  getLastAppUsagePercent,
  getLastBusinessUsagePercent,
  updateUsagePercent,
  isInDangerZone,
  isAtCriticalLimit,
  parseUsageHeader,
  calculateUsageBackoffMs,
  applyDangerZoneBackoff,
} from "./rate-limiter";

import {
  MetaApiError,
  TokenExpiredError,
  RateLimitError,
  PermissionError,
  PolicyBlockError,
  MessagingWindowExpiredError,
  CommentAlreadyRepliedError,
  UserUnreachableError,
} from "./errors";
import type {
  GraphApiError,
  InstagramUser,
  InstagramComment,
  InstagramMedia,
  InstagramMediaInsights,
  TokenResponse,
  MediaType,
  MetaButton,
  GenericTemplateElement,
  QuickReplyOption,
} from "./types";
import {
  APP_USAGE_WARN_THRESHOLD,
  APP_USAGE_DANGER_THRESHOLD,
  APP_USAGE_CRITICAL_THRESHOLD,
  updateUsagePercent,
  parseUsageHeader,
  applyDangerZoneBackoff,
} from "./rate-limiter";


/**
 * A wrapper around global fetch that guarantees the danger zone backoff is applied
 * before ANY outgoing request to the Meta API.
 */
export async function metaFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  await applyDangerZoneBackoff();
  return fetch(input, init);
}

async function handleResponse<T>(response: Response): Promise<T> {
  // â”€â”€ Parse and track rate-limit headers (Meta Graph API v25.0) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const appUsageHeader = response.headers.get("x-app-usage");
  const businessUsageHeader = response.headers.get("x-business-use-case-usage");

  const appUsage = parseUsageHeader(appUsageHeader);
  const businessUsage = parseUsageHeader(businessUsageHeader);

  updateUsagePercent(appUsage, businessUsage);

  const maxUsage = Math.max(appUsage, businessUsage);

  if (maxUsage >= APP_USAGE_CRITICAL_THRESHOLD) {
    console.error(
      `[Meta API] CRITICAL rate limit: ${maxUsage}% (app=${appUsage}%, business=${businessUsage}%)`
    );
  } else if (maxUsage >= APP_USAGE_DANGER_THRESHOLD) {
    console.warn(
      `[Meta API] Danger zone: ${maxUsage}% (app=${appUsage}%, business=${businessUsage}%)`
    );
  } else if (maxUsage >= APP_USAGE_WARN_THRESHOLD) {
    console.warn(
      `[Meta API] Rate limit warning: ${maxUsage}% (app=${appUsage}%, business=${businessUsage}%)`
    );
  }

  const data = await response.json();

  if (!response.ok || (data as GraphApiError).error) {
    const err = (data as GraphApiError).error;
    const code = err?.code ?? response.status;
    const subcode = err?.error_subcode;
    const traceId = err?.fbtrace_id;
    const message = err?.message ?? "Unknown Meta API error";

    // â”€â”€ Retry-After header: Meta sometimes sets this on 429s â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const retryAfterSec = response.headers.get("retry-after");
    const retryAfterMs = retryAfterSec
      ? Math.min(Number(retryAfterSec) * 1000, 3_600_000) // cap at 1 hour
      : 60_000;

    switch (code) {
      case 190:
        throw new TokenExpiredError(message, traceId);

      case 368:
        throw new PolicyBlockError(message, traceId);

      // â”€â”€ All rate-limit codes from Meta's documentation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // 4   = Application request limit reached
      // 17  = User request limit reached
      // 32  = Page-level throttling
      // 613 = Calls to this API endpoint have exceeded the rate limit
      // 80001 = Too many calls to this endpoint per hour
      case 4:
      case 17:
      case 32:
      case 613:
      case 80001:
        throw new RateLimitError(message, traceId, retryAfterMs);

      case 10:
      case 100:
      case 200:
        if (subcode === 2534015) {
          throw new CommentAlreadyRepliedError(message, traceId);
        }
        if (subcode === 2534014 || subcode === 2018028 || subcode === 2018278) {
          throw new MessagingWindowExpiredError(subcode, message, traceId);
        }
        if (subcode === 2018001) {
          throw new UserUnreachableError(message, traceId);
        }
        throw new PermissionError(message, traceId);

      default:
        throw new MetaApiError(code, subcode, traceId, message);
    }
  }

  return data as T;
}

/**
 * Send a private reply to a comment as a plain DM.
 * Used when no opening-DM flow or tracked link is configured.
 */
export async function sendPrivateReply(
  accessToken: string,
  instagramAccountId: string,
  commentId: string,
  message: string
): Promise<{ recipient_id: string; message_id: string }> {
  const response = await metaFetch(
    `${instagramGraphBase()}/${instagramAccountId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        recipient: { comment_id: commentId },
        message: { text: message.slice(0, 1000) },
      }),
    }
  );

  return handleResponse(response);
}

/**
 * Send a private reply to a comment as a button template — an opening message
 * plus a postback button. Tapping the button opens the conversation and fires
 * a `messaging_postbacks` webhook carrying `payload`, which we use to deliver
 * the follow-up ("reveal") message.
 */
export async function sendPrivateReplyWithButton(
  accessToken: string,
  instagramAccountId: string,
  commentId: string,
  text: string,
  buttonTitle: string,
  payload: string
): Promise<{ recipient_id: string; message_id: string }> {
  const response = await metaFetch(
    `${instagramGraphBase()}/${instagramAccountId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        recipient: { comment_id: commentId },
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "button",
              // Button template text is capped at 640 chars by Meta.
              text: text.slice(0, 640),
              buttons: [
                { type: "postback", title: buttonTitle.slice(0, 20), payload },
              ],
            },
          },
        },
      }),
    }
  );

  return handleResponse(response);
}

/**
 * Send a private reply to a comment as a button template with a web_url button
 * — the reveal message plus a tappable link button (for campaigns with no
 * opening DM, where the reveal is delivered straight to the comment).
 */
export async function sendPrivateReplyWithLinkButton(
  accessToken: string,
  instagramAccountId: string,
  commentId: string,
  text: string,
  buttonTitle: string,
  url: string
): Promise<{ recipient_id: string; message_id: string }> {
  const response = await metaFetch(
    `${instagramGraphBase()}/${instagramAccountId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        recipient: { comment_id: commentId },
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "button",
              text: text.slice(0, 640),
              buttons: [{ type: "web_url", url, title: buttonTitle.slice(0, 20) }],
            },
          },
        },
      }),
    }
  );

  return handleResponse(response);
}

/**
 * Send a plain-text direct message to a user by their Instagram-scoped ID.
 * Used to deliver the reveal message after a button postback.
 */
export async function sendDirectMessage(
  accessToken: string,
  instagramAccountId: string,
  userId: string,
  message: string
): Promise<{ recipient_id: string; message_id: string }> {
  const response = await metaFetch(
    `${instagramGraphBase()}/${instagramAccountId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        recipient: { id: userId },
        message: { text: message.slice(0, 1000) },
      }),
    }
  );

  return handleResponse(response);
}

/**
 * Send a direct message as a button template with a single web_url button â€”
 * the reveal message plus a tappable link button (cleaner than an inline URL).
 */
export async function sendDirectMessageWithLinkButton(
  accessToken: string,
  instagramAccountId: string,
  userId: string,
  text: string,
  buttonTitle: string,
  url: string
): Promise<{ recipient_id: string; message_id: string }> {
  const response = await metaFetch(
    `${instagramGraphBase()}/${instagramAccountId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        recipient: { id: userId },
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "button",
              text: text.slice(0, 640),
              buttons: [{ type: "web_url", url, title: buttonTitle.slice(0, 20) }],
            },
          },
        },
      }),
    }
  );

  return handleResponse(response);
}


/**
 * Send a rich media file (Image, Video, or Voice Audio) directly in Instagram DM.
 * Meta Graph API v25.0 compliant.
 */
export async function sendDirectMediaMessage(
  accessToken: string,
  instagramAccountId: string,
  userId: string,
  mediaType: MediaType,
  mediaUrl: string
): Promise<{ recipient_id: string; message_id: string }> {
  const response = await metaFetch(
    `${instagramGraphBase()}/${instagramAccountId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        recipient: { id: userId },
        message: {
          attachment: {
            type: mediaType,
            payload: {
              url: mediaUrl,
              is_reusable: true,
            },
          },
        },
      }),
    }
  );

  return handleResponse(response);
}

/**
 * Send a Generic Template Carousel message (horizontal scrollable cards).
 * Each card can have an image, title, subtitle, and up to 3 CTA buttons.
 * Supports up to 10 cards per carousel.
 */
export async function sendDirectGenericTemplate(
  accessToken: string,
  instagramAccountId: string,
  userId: string,
  elements: GenericTemplateElement[]
): Promise<{ recipient_id: string; message_id: string }> {
  const sanitizedElements = elements.slice(0, 10).map((el) => ({
    title: el.title.slice(0, 80),
    subtitle: el.subtitle ? el.subtitle.slice(0, 80) : undefined,
    image_url: el.image_url,
    default_action: el.default_action,
    buttons: el.buttons?.slice(0, 3).map((btn) => ({
      type: btn.type,
      title: btn.title.slice(0, 20),
      ...(btn.type === "web_url" ? { url: btn.url } : { payload: btn.payload }),
    })),
  }));

  const response = await metaFetch(
    `${instagramGraphBase()}/${instagramAccountId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        recipient: { id: userId },
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "generic",
              elements: sanitizedElements,
            },
          },
        },
      }),
    }
  );

  return handleResponse(response);
}

/**
 * Send a text message with interactive Quick Reply chips (up to 13 buttons).
 * Tapping a chip sends a webhook message event with `message.quick_reply.payload`.
 */
export async function sendDirectQuickReplies(
  accessToken: string,
  instagramAccountId: string,
  userId: string,
  text: string,
  quickReplies: QuickReplyOption[]
): Promise<{ recipient_id: string; message_id: string }> {
  const sanitizedReplies = quickReplies.slice(0, 13).map((qr) => ({
    content_type: "text",
    title: qr.title.slice(0, 20),
    payload: qr.payload,
    ...(qr.image_url ? { image_url: qr.image_url } : {}),
  }));

  const response = await metaFetch(
    `${instagramGraphBase()}/${instagramAccountId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        recipient: { id: userId },
        message: {
          text: text.slice(0, 1000),
          quick_replies: sanitizedReplies,
        },
      }),
    }
  );

  return handleResponse(response);
}

/**
 * Send a direct message with multiple CTA buttons (up to 3 buttons).
 */
export async function sendDirectMessageWithMultipleButtons(
  accessToken: string,
  instagramAccountId: string,
  userId: string,
  text: string,
  buttons: MetaButton[]
): Promise<{ recipient_id: string; message_id: string }> {
  const sanitizedButtons = buttons.slice(0, 3).map((btn) => ({
    type: btn.type,
    title: btn.title.slice(0, 20),
    ...(btn.type === "web_url" ? { url: btn.url } : { payload: btn.payload }),
  }));

  const response = await metaFetch(
    `${instagramGraphBase()}/${instagramAccountId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        recipient: { id: userId },
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "button",
              text: text.slice(0, 640),
              buttons: sanitizedButtons,
            },
          },
        },
      }),
    }
  );

  return handleResponse(response);
}

/**
 * Configure Instagram profile Icebreakers (FAQ starter prompts in empty DM chats).
 */
export async function setInstagramIcebreakers(
  accessToken: string,
  instagramAccountId: string,
  icebreakers: Array<{ question: string; payload: string }>
): Promise<{ result: string }> {
  const response = await metaFetch(
    `${instagramGraphBase()}/${instagramAccountId}/messenger_profile`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        platform: "instagram",
        ice_breakers: icebreakers.slice(0, 4).map((ib) => ({
          question: ib.question.slice(0, 80),
          payload: ib.payload,
        })),
      }),
    }
  );

  return handleResponse(response);
}

export async function sendCommentReply(
  accessToken: string,
  commentId: string,
  message: string
): Promise<{ id: string }> {
  const response = await metaFetch(
    `${instagramGraphBase()}/${commentId}/replies`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ message }),
    }
  );

  return handleResponse(response);
}

/**
 * Hide or unhide a comment on Instagram (Meta Graph API v25.0).
 * Useful for spam control, negative comment filtering, or automated moderation.
 */
export async function hideComment(
  accessToken: string,
  commentId: string,
  hide = true
): Promise<{ success: boolean }> {
  const response = await metaFetch(
    `${instagramGraphBase()}/${commentId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ hide }),
    }
  );

  return handleResponse(response);
}

/**
 * Delete a comment on Instagram (Meta Graph API v25.0).
 */
export async function deleteComment(
  accessToken: string,
  commentId: string
): Promise<{ success: boolean }> {
  const response = await metaFetch(
    `${instagramGraphBase()}/${commentId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  return handleResponse(response);
}

export async function getMediaComments(
  accessToken: string,
  mediaId: string
): Promise<InstagramComment[]> {
  const url = new URL(`${instagramGraphBase()}/${mediaId}/comments`);
  url.searchParams.set("fields", "id,text,from,timestamp");
  url.searchParams.set("access_token", accessToken);

  const response = await metaFetch(url.toString());
  const data = await handleResponse<{ data: InstagramComment[] }>(response);
  return data.data;
}

/**
 * Recent comments on a media, newest first, each with its replies so the caller
 * can tell whether the account owner has already responded. Pagination stops as
 * soon as it reaches comments older than `sinceMs` (or the `max` ceiling), so a
 * viral post's entire back-catalogue is never pulled â€” only what is recent
 * enough to still act on. This is what the polling reconciler reads.
 *
 * Note: comments hidden by Instagram's Hidden Words / spam filter may not be
 * returned by the Graph API at all. Disable that filter on the account to widen
 * results.
 */
export async function getRecentMediaComments(
  accessToken: string,
  mediaId: string,
  sinceMs: number,
  max = 800
): Promise<InstagramComment[]> {
  const results: InstagramComment[] = [];

  const first = new URL(`${instagramGraphBase()}/${mediaId}/comments`);
  first.searchParams.set("fields", "id,text,timestamp,from,replies{from}");
  first.searchParams.set("order", "reverse_chronological");
  first.searchParams.set("limit", "50");
  first.searchParams.set("access_token", accessToken);

  let nextUrl: string | null = first.toString();

  while (nextUrl !== null && results.length < max) {
    const response: Response = await metaFetch(nextUrl);
    const page = await handleResponse<{
      data: InstagramComment[];
      paging?: { next?: string };
    }>(response);
    const data = page.data ?? [];
    results.push(...data);

    // Newest-first, so once the last item on a page predates the window there
    // is nothing older worth fetching.
    const oldest = data[data.length - 1];
    if (oldest?.timestamp && Date.parse(oldest.timestamp) < sinceMs) break;
    nextUrl = page.paging?.next ?? null;
  }

  return results
    .filter((c) => !c.timestamp || Date.parse(c.timestamp) >= sinceMs)
    .slice(0, max);
}

// --- Direct message inbox (Conversations API) ---------------------------

export interface InstagramParticipant {
  id: string;
  username?: string;
}

export interface InstagramMessage {
  id: string;
  created_time?: string;
  message?: string;
  from?: InstagramParticipant;
  to?: { data: InstagramParticipant[] };
}

export interface InstagramConversation {
  id: string;
  updated_time?: string;
  participants?: { data: InstagramParticipant[] };
  messages?: { data: InstagramMessage[] };
}

/**
 * List the account's DM conversations, newest first, each with its participants
 * and a one-message preview. `igUserId` is the account's professional user_id
 * (the same id used to send messages and as webhook entry.id).
 */
export async function getConversations(
  accessToken: string,
  igUserId: string
): Promise<InstagramConversation[]> {
  const url = new URL(`${instagramGraphBase()}/${igUserId}/conversations`);
  url.searchParams.set("platform", "instagram");
  url.searchParams.set(
    "fields",
    "participants,updated_time,messages.limit(1){message,from,created_time}"
  );
  url.searchParams.set("limit", "50");
  url.searchParams.set("access_token", accessToken);

  const response = await metaFetch(url.toString());
  const data = await handleResponse<{ data: InstagramConversation[] }>(response);
  return data.data ?? [];
}

/**
 * The messages in a conversation, with content. Meta only returns full details
 * for the 20 most recent messages, newest first.
 */
export async function getConversationMessages(
  accessToken: string,
  conversationId: string
): Promise<InstagramMessage[]> {
  const url = new URL(`${instagramGraphBase()}/${conversationId}`);
  url.searchParams.set("fields", "messages{id,created_time,from,to,message}");
  url.searchParams.set("access_token", accessToken);

  const response = await metaFetch(url.toString());
  const data = await handleResponse<{ messages?: { data: InstagramMessage[] } }>(
    response
  );
  return data.messages?.data ?? [];
}

export async function getUserInfo(accessToken: string): Promise<InstagramUser> {
  const url = new URL(`${instagramGraphBase()}/me`);
  url.searchParams.set(
    "fields",
    "id,user_id,username,name"
  );
  url.searchParams.set("access_token", accessToken);

  const response = await metaFetch(url.toString());
  return handleResponse<InstagramUser>(response);
}

const MEDIA_FIELDS =
  "id,caption,media_type,media_product_type,media_url,thumbnail_url,timestamp,permalink,like_count,comments_count";

// Instagram caps a single media page at 100 items.
const MEDIA_PAGE_SIZE = 100;

export async function getUserMedia(
  accessToken: string,
  limit = 25
): Promise<InstagramMedia[]> {
  const url = new URL(`${instagramGraphBase()}/me/media`);
  url.searchParams.set("fields", MEDIA_FIELDS);
  url.searchParams.set("limit", limit.toString());
  url.searchParams.set("access_token", accessToken);

  const response = await metaFetch(url.toString());
  const data = await handleResponse<{ data: InstagramMedia[] }>(response);
  return data.data;
}

/**
 * Fetch media by following pagination cursors until `max` items are collected
 * or there are no more pages. Pass a large `max` for an "all time" view; the
 * cap is a safety ceiling so an account with thousands of posts can't spin
 * forever (and so downstream per-media insight calls stay bounded).
 */
export async function getAllUserMedia(
  accessToken: string,
  max = 500
): Promise<InstagramMedia[]> {
  const results: InstagramMedia[] = [];

  const first = new URL(`${instagramGraphBase()}/me/media`);
  first.searchParams.set("fields", MEDIA_FIELDS);
  first.searchParams.set("limit", String(Math.min(MEDIA_PAGE_SIZE, max)));
  first.searchParams.set("access_token", accessToken);

  let nextUrl: string | null = first.toString();

  while (nextUrl !== null && results.length < max) {
    const response: Response = await metaFetch(nextUrl);
    const page = await handleResponse<{
      data: InstagramMedia[];
      paging?: { next?: string };
    }>(response);
    results.push(...page.data);
    nextUrl = page.paging?.next ?? null;
  }

  return results.slice(0, max);
}

/**
 * Fetch per-media insight metrics (views, reach, saved, shares, etc.).
 *
 * Requires the `instagram_business_manage_insights` permission â€” accounts
 * connected before that scope was requested will throw a PermissionError.
 * Metric validity varies by media type, so pass only metrics that apply to
 * the given media (e.g. `views` is not valid for image posts on some accounts).
 */
export async function getMediaInsights(
  accessToken: string,
  mediaId: string,
  metrics: string[]
): Promise<InstagramMediaInsights> {
  const url = new URL(`${instagramGraphBase()}/${mediaId}/insights`);
  url.searchParams.set("metric", metrics.join(","));
  url.searchParams.set("access_token", accessToken);

  const response = await metaFetch(url.toString());
  const data = await handleResponse<{
    data: Array<{ name: string; values: Array<{ value: number }> }>;
  }>(response);

  const result: InstagramMediaInsights = {};
  for (const entry of data.data) {
    result[entry.name as keyof InstagramMediaInsights] =
      entry.values?.[0]?.value ?? 0;
  }
  return result;
}

export async function getLongLivedToken(
  shortLivedToken: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const url = new URL(`https://graph.instagram.com/access_token`);
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", requireEnv("INSTAGRAM_APP_SECRET"));
  url.searchParams.set("access_token", shortLivedToken);

  const response = await metaFetch(url.toString());
  const data = await handleResponse<TokenResponse>(response);

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in ?? 5184000,
  };
}

export async function refreshLongLivedToken(
  longLivedToken: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const url = new URL(`https://graph.instagram.com/refresh_access_token`);
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", longLivedToken);

  const response = await metaFetch(url.toString());
  const data = await handleResponse<TokenResponse>(response);

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in ?? 5184000,
  };
}

export async function subscribeInstagramAccountToWebhooks(
  instagramAccountId: string,
  accessToken: string
): Promise<{ success: boolean }> {
  const response = await metaFetch(
    `${instagramGraphBase()}/${instagramAccountId}/subscribed_apps`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        subscribed_fields: ["comments", "messages"],
      }),
    }
  );

  return handleResponse(response);
}

export async function debugToken(inputToken: string, accessToken: string) {
  const url = new URL(`${facebookGraphBase()}/debug_token`);
  url.searchParams.set("input_token", inputToken);
  url.searchParams.set("access_token", accessToken);
  const response = await metaFetch(url.toString());
  return handleResponse(response);
}
