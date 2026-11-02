/**
 * OpenReply CRM Sync Integration Service
 * Routes captured leads from OpenReply to the PHP Admin CRM (admin.php)
 * via the PhpBookingClient's HMAC-authenticated API.
 * Ensures zero lead loss with durable sync state tracking on the Lead model.
 */
import { prisma } from "@/lib/db/client";
import { phpBookingClient } from "@/lib/services/php-booking-client";
import { dispatchOutboundLeadWebhook } from "./outbound-webhook";

export interface SyncLeadPayload {
  leadId?: string;
  phone?: string;
  email?: string;
  full_name?: string;
  username?: string;
  lead_source?: string;
  igsid?: string;
  instagramAccountId?: string;
  provider?: "META" | "BOXAPI";
  externalUserId?: string;
  custom_data?: Record<string, unknown>;
}

export async function syncLeadToWampCrm(payload: SyncLeadPayload): Promise<boolean> {
  const { leadId, instagramAccountId, igsid } = payload;

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
      custom_data: {
        ...payload.custom_data,
        provider: payload.provider || "META",
        external_user_id: payload.externalUserId,
      },
    });

    // Update Lead sync telemetry if leadId or account+igsid is available
    const leadLookup = leadId
      ? { id: leadId }
      : instagramAccountId && igsid
      ? { id: `lead_${instagramAccountId}_${igsid}` }
      : null;

    if (leadLookup) {
      if (result.success) {
        await prisma.lead
          .update({
            where: leadLookup,
            data: {
              crmSyncStatus: "SYNCED",
              crmSyncedAt: new Date(),
              crmLeadId: result.crm_lead_id?.toString() || null,
              crmError: null,
            },
          })
          .catch(() => {});
      } else {
        await prisma.lead
          .update({
            where: leadLookup,
            data: {
              crmSyncStatus: "FAILED",
              crmError: result.message || "Failed CRM response",
            },
          })
          .catch(() => {});
      }
    }

    if (!result.success) {
      console.warn("[CRM Sync] Lead sync returned unsuccessful response:", result.message);
    }

    return result.success;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[CRM Sync] Connection failed (CRM offline or unreachable):", errorMsg);

    const leadLookup = leadId
      ? { id: leadId }
      : instagramAccountId && igsid
      ? { id: `lead_${instagramAccountId}_${igsid}` }
      : null;

    if (leadLookup) {
      await prisma.lead
        .update({
          where: leadLookup,
          data: {
            crmSyncStatus: "FAILED",
            crmError: `Connection error: ${errorMsg}`,
          },
        })
        .catch(() => {});
    }

    return false;
  }
}
