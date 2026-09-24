import { prisma } from "@/lib/db/client";
import { getFeatureConfig, isFeatureEnabled } from "@/lib/flags/feature-flags";
import { pushToDLQ } from "@/lib/queue/dlq";

export interface SmsFallbackParams {
  workspaceId: string;
  phoneNumber: string;
  messageText: string;
  userId?: string;
  reason?: string;
}

export async function sendSmsFallback(params: SmsFallbackParams): Promise<{ success: boolean; error?: string }> {
  const enabled = await isFeatureEnabled("SMS_FALLBACK", params.workspaceId);
  if (!enabled) {
    return { success: false, error: "SMS Fallback feature disabled" };
  }

  const config = await getFeatureConfig("SMS_FALLBACK", params.workspaceId);
  const apiKey = process.env.KAVENEGAR_API_KEY || process.env.SMS_API_KEY;

  if (!apiKey) {
    const errStr = "SMS Gateway API key not configured";
    await pushToDLQ({
      workspaceId: params.workspaceId,
      source: "SMS_FALLBACK",
      payload: params,
      errorMessage: errStr,
    });
    return { success: false, error: errStr };
  }

  try {
    // Call Kavenegar or generic SMS API
    const response = await fetch(
      `https://api.kavenegar.com/v1/${apiKey}/sms/send.json?receptor=${encodeURIComponent(
        params.phoneNumber
      )}&message=${encodeURIComponent(params.messageText)}`,
      { method: "GET" }
    );

    const data = await response.json();
    if (data?.return?.status === 200) {
      return { success: true };
    } else {
      const errMsg = data?.return?.message || "SMS Provider returned non-200 error";
      await pushToDLQ({
        workspaceId: params.workspaceId,
        source: "SMS_FALLBACK",
        payload: params,
        errorMessage: errMsg,
      });
      return { success: false, error: errMsg };
    }
  } catch (error: any) {
    const errMsg = error.message || "Failed to send SMS fallback";
    await pushToDLQ({
      workspaceId: params.workspaceId,
      source: "SMS_FALLBACK",
      payload: params,
      errorMessage: errMsg,
    });
    return { success: false, error: errMsg };
  }
}
