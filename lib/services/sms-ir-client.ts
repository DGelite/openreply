/**
 * SmsIrClient - Direct Type-Safe TypeScript SDK for sms.ir v1 REST API
 * Strictly aligned with https://sms.ir/rest-api/ documentation standards.
 */

export interface SmsIrParameter {
  name: string;
  value: string;
}

export interface SmsIrPatternPayload {
  mobile: string;
  templateId: number;
  parameters: SmsIrParameter[];
}

export interface SmsIrBulkPayload {
  lineNumber: string | number;
  messageText: string;
  mobiles: string[];
  sendDateTime?: number | null;
}

export class SmsIrClient {
  private apiKey: string;
  private baseUrl: string = "https://api.sms.ir/v1/";

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.SMS_IR_API_KEY || "";
  }

  private getHeaders(): Record<string, string> {
    if (!this.apiKey) {
      throw new Error("SMS.ir API Key is not configured.");
    }
    return {
      "Content-Type": "application/json",
      "X-API-KEY": this.apiKey,
      Accept: "application/json",
    };
  }

  /**
   * Send Pattern-based (Verify/OTP) SMS via https://api.sms.ir/v1/send/verify
   */
  public async sendPattern(
    receptor: string,
    templateId: number | string,
    parameters: Record<string, string> | SmsIrParameter[]
  ): Promise<any> {
    const formattedParams: SmsIrParameter[] = Array.isArray(parameters)
      ? parameters
      : Object.entries(parameters).map(([name, value]) => ({ name, value: String(value) }));

    const payload: SmsIrPatternPayload = {
      mobile: receptor.replace(/[^0-9]/g, ""),
      templateId: Number(templateId),
      parameters: formattedParams,
    };

    const response = await fetch(`${this.baseUrl}send/verify`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    const data = await response.json();
    if (!response.ok || data.status === 0) {
      throw new Error(data.message || `SMS.ir Pattern Error (HTTP ${response.status})`);
    }

    return data;
  }

  /**
   * Send Bulk/Direct Text SMS via https://api.sms.ir/v1/send/bulk
   */
  public async sendBulk(message: string, receptors: string[], lineNumber?: string): Promise<any> {
    const line = lineNumber || process.env.SMS_IR_LINE_NUMBER || "";
    if (!line) {
      throw new Error("Sender line number is not configured.");
    }

    const payload: SmsIrBulkPayload = {
      lineNumber: isNaN(Number(line)) ? line : Number(line),
      messageText: message.trim(),
      mobiles: receptors.map((r) => r.replace(/[^0-9]/g, "")),
      sendDateTime: null,
    };

    const response = await fetch(`${this.baseUrl}send/bulk`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    const data = await response.json();
    if (!response.ok || data.status === 0) {
      throw new Error(data.message || `SMS.ir Bulk Error (HTTP ${response.status})`);
    }

    return data;
  }

  /**
   * Fetch Account Credit Balance via https://api.sms.ir/v1/credit
   */
  public async getCredit(): Promise<{ credit: number; currency: string }> {
    const response = await fetch(`${this.baseUrl}credit`, {
      method: "GET",
      headers: this.getHeaders(),
      signal: AbortSignal.timeout(10_000),
    });

    const data = await response.json();
    if (!response.ok || data.status === 0) {
      throw new Error(data.message || `SMS.ir Credit Fetch Error (HTTP ${response.status})`);
    }

    return {
      credit: Number(data.data?.credit || 0),
      currency: "Rial",
    };
  }
}

export const smsIrClient = new SmsIrClient();
