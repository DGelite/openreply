/**
 * OpenReply CRM Sync Integration Service
 * Routes captured leads from OpenReply to the PHP Admin CRM (admin.php)
 * via the PhpBookingClient's HMAC-authenticated API.
 */
import { phpBookingClient } from "@/lib/services/php-booking-client";
import { dispatchOutboundLeadWebhook } from "./outbound-webhook";

export interface SyncLeadPayload {
  phone?: string;
  email?: string;
  full_name?: string;
  username?: string;
  lead_source?: string;
  igsid?: string;
  custom_data?: Record<string, unknown>;
}

export async function syncLeadToWampCrm(payload: SyncLeadPayload): Promise<boolean> {
  try {
    // Trigger outbound webhook in background for Zapier/Make/Custom integrations
    void dispatchOutboundLeadWebhook({
      email: payload.email,
      phone: payload.phone,
      username: payload.username,
      igsid: payload.igsid,
      leadSource: payload.lead_source,
      customData: payload.custom_data,
    });

    const result = await phpBookingClient.syncLead({
      phone: payload.phone,
      email: payload.email,
      full_name: payload.full_name || payload.username,
      username: payload.username,
      instagram_handle: payload.username,
      lead_source: payload.lead_source || "openreply-instagram",
      igsid: payload.igsid,
      custom_data: payload.custom_data,
    });

    if (!result.success) {
      console.error("[CRM Sync] Lead sync returned unsuccessful response:", result.message);
    }

    return result.success;
  } catch (error) {
    // CRM sync failures must never crash the main automation flow
    console.error("[CRM Sync] Connection failed:", error instanceof Error ? error.message : error);
    return false;
  }
}
