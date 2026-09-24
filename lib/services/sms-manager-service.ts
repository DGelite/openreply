import { SmsIrClient } from "./sms-ir-client";
import { phpBookingClient } from "./php-booking-client";

export type SmsMode = "DIRECT" | "PHP_PROXY" | "HYBRID";

export interface SendSmsOptions {
  mode?: SmsMode;
  type?: "pattern" | "bulk";
  receptor: string;
  templateId?: string | number;
  parameters?: Record<string, string> | Array<{ name: string; value: string }>;
  message?: string;
}

export class SmsManagerService {
  /**
   * Send SMS dynamically based on configured Mode (Direct, PHP Proxy, or Hybrid Fallback)
   */
  public async sendSms(options: SendSmsOptions): Promise<any> {
    const mode: SmsMode = (options.mode || process.env.SMS_INTEGRATION_MODE || "HYBRID") as SmsMode;

    if (mode === "DIRECT") {
      return this.sendDirect(options);
    }

    if (mode === "PHP_PROXY") {
      return this.sendViaPhpProxy(options);
    }

    // HYBRID Mode: Try Direct first, fallback to PHP Proxy
    try {
      if (process.env.SMS_IR_API_KEY) {
        return await this.sendDirect(options);
      }
    } catch (error) {
      console.warn("[SMS Service] Direct sms.ir send failed, failing over to PHP Proxy:", error instanceof Error ? error.message : error);
    }

    return this.sendViaPhpProxy(options);
  }

  /**
   * Direct dispatch via sms.ir REST API
   */
  private async sendDirect(options: SendSmsOptions): Promise<any> {
    const client = new SmsIrClient();
    if (options.type === "bulk" || (!options.templateId && options.message)) {
      return client.sendBulk(options.message || "", [options.receptor]);
    }
    return client.sendPattern(options.receptor, options.templateId || process.env.SMS_IR_TEMPLATE_ID || "100000", options.parameters || {});
  }

  /**
   * Proxied dispatch via PHP Reservation Server HMAC Gateway
   */
  private async sendViaPhpProxy(options: SendSmsOptions): Promise<any> {
    const payload = {
      action: "send_sms",
      type: options.type || (options.templateId ? "pattern" : "bulk"),
      receptor: options.receptor,
      template_id: options.templateId,
      parameters: options.parameters,
      message: options.message,
    };

    return phpBookingClient.request("POST", payload);
  }

  /**
   * Fetch current credit balance
   */
  public async getCredit(mode?: SmsMode): Promise<{ credit: number; currency: string; source: string }> {
    const targetMode = mode || (process.env.SMS_INTEGRATION_MODE as SmsMode) || "HYBRID";

    if (targetMode === "DIRECT" || (targetMode === "HYBRID" && process.env.SMS_IR_API_KEY)) {
      try {
        const client = new SmsIrClient();
        const res = await client.getCredit();
        return { ...res, source: "sms.ir (Direct)" };
      } catch (err) {
        console.warn("[SMS Service] Direct credit query failed, checking PHP Proxy...", err);
      }
    }

    try {
      const phpRes = await phpBookingClient.request<{ credit?: number; currency?: string }>("GET", { action: "get_sms_credit" });
      return {
        credit: Number(phpRes.credit || 0),
        currency: phpRes.currency || "Rial",
        source: "PHP Reservation Server (Proxy)",
      };
    } catch (err) {
      return {
        credit: 0,
        currency: "Rial",
        source: "Disconnected",
      };
    }
  }
}

export const smsManagerService = new SmsManagerService();
