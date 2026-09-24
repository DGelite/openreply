/**
 * OpenReply Outbound Webhook Integrator
 * Automatically dispatches captured leads (email, phone, username, campaign data)
 * to Zapier, Make.com, Pabbly, or custom Webhook URLs in real-time.
 */

export interface LeadWebhookPayload {
  email?: string;
  phone?: string;
  username?: string;
  igsid?: string;
  leadSource?: string;
  workspaceId?: string;
  timestamp?: string;
  customData?: Record<string, unknown>;
}

export async function dispatchOutboundLeadWebhook(
  payload: LeadWebhookPayload,
  webhookUrl?: string
): Promise<boolean> {
  const targetUrl = webhookUrl || process.env.OUTBOUND_LEAD_WEBHOOK_URL || process.env.LEAD_WEBHOOK_URL;
  if (!targetUrl) return false;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "OpenReply-LeadSync/1.0",
      },
      body: JSON.stringify({
        event: "lead.captured",
        data: {
          email: payload.email,
          phone: payload.phone,
          username: payload.username,
          igsid: payload.igsid,
          lead_source: payload.leadSource || "openreply-instagram-dm",
          workspace_id: payload.workspaceId,
          timestamp: payload.timestamp || new Date().toISOString(),
          custom_data: payload.customData || {},
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.error("[Outbound Webhook] Failed to dispatch lead webhook:", error instanceof Error ? error.message : error);
    return false;
  }
}
