/**
 * OpenReply Instagram Ref Link & Growth Tools Module
 * Parses `ig.me/m/[username]?ref=[payload]` referral parameters and
 * constructs Instagram short-links for print packaging, flyers, and stories.
 */

export interface InstagramRefLinkConfig {
  username: string;
  refPayload: string;
}

export function buildInstagramRefLink(config: InstagramRefLinkConfig): string {
  const cleanUsername = config.username.replace(/^@/, "").trim();
  const encodedPayload = encodeURIComponent(config.refPayload.trim());
  return `https://ig.me/m/${cleanUsername}?ref=${encodedPayload}`;
}

export function parseInstagramRefPayload(rawRef?: string): {
  isRefLink: boolean;
  refCode?: string;
} {
  if (!rawRef) return { isRefLink: false };
  const trimmed = rawRef.trim();
  return {
    isRefLink: true,
    refCode: trimmed,
  };
}
