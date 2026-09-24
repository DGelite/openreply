import crypto from "node:crypto";

export interface BookingSlot {
  start_time: string;
  end_time: string;
  full_datetime: string;
  available: boolean;
  remaining_capacity: number;
}

export interface GetSlotsResponse {
  success: boolean;
  date: string;
  is_working_day: boolean;
  message?: string;
  total_slots?: number;
  slots: BookingSlot[];
}

export interface RequestOtpParams {
  phone: string;
  full_name?: string;
  instagram_handle?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

export interface RequestOtpResponse {
  success: boolean;
  waitlist_id: number;
  phone: string;
  sms_sent: boolean;
  message: string;
  debug_otp?: string;
}

export interface ConfirmBookingParams {
  waitlist_id: number;
  otp: string;
  appointment_time?: string;
}

export interface ConfirmBookingResponse {
  success: boolean;
  waitlist_id: number;
  crm_lead_id: number;
  lead_score: number;
  assigned_agent_id: number | null;
  assigned_agent_name: string;
  appointment_time: string;
  message: string;
}

export interface SyncLeadDirectParams {
  phone?: string;
  email?: string;
  full_name?: string;
  username?: string;
  instagram_handle?: string;
  lead_source?: string;
  igsid?: string;
  custom_data?: Record<string, unknown>;
}

/** Default connection timeout: 8 seconds. */
const DEFAULT_TIMEOUT_MS = 8000;

/**
 * PhpBookingClient
 * Type-safe TypeScript SDK connecting OpenReply to the PHP Booking & CRM system (admin.php).
 *
 * Authentication uses HMAC-SHA256 signed requests (X-Signature + X-Timestamp headers).
 * The raw API secret is never sent in request headers for security.
 *
 * Local server:  http://localhost/admin.php   (C:\wamp64\www\admin.php)
 * Production:    Set PHP_ADMIN_API_URL env var to your online server URL.
 */
export class PhpBookingClient {
  private baseUrl: string;
  private apiSecret: string;
  private timeoutMs: number;

  constructor(
    baseUrl: string = process.env.PHP_ADMIN_API_URL || "http://localhost/admin.php",
    apiSecret: string = process.env.PHP_ADMIN_API_SECRET || "de_secure_api_key_2026_x892n3m",
    timeoutMs: number = DEFAULT_TIMEOUT_MS
  ) {
    // Validate URL format — fail fast with a useful message
    if (!baseUrl || !baseUrl.startsWith("http")) {
      throw new Error(
        `PhpBookingClient: Invalid base URL "${baseUrl}". Set PHP_ADMIN_API_URL in your .env file.`
      );
    }
    try {
      new URL(baseUrl); // throws on malformed URL
    } catch {
      throw new Error(
        `PhpBookingClient: Malformed PHP Admin URL "${baseUrl}". Must be a full URL like http://yourdomain.com/admin.php`
      );
    }

    this.baseUrl = baseUrl;
    this.apiSecret = apiSecret;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Generate HMAC-SHA256 authentication headers.
   * Only X-Signature and X-Timestamp are sent — the raw secret is never exposed.
   */
  private generateHmacHeaders(bodyStr: string): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = crypto
      .createHmac("sha256", this.apiSecret)
      .update(`${timestamp}.${bodyStr}`)
      .digest("hex");

    return {
      "Content-Type": "application/json",
      "X-Timestamp": timestamp,
      "X-Signature": signature,
      // NOTE: Raw secret is intentionally NOT sent in Authorization header.
      // PHP side must verify via HMAC: sha256(secret, "timestamp.body") === X-Signature
    };
  }

  /**
   * Execute a fetch with configurable timeout, and 1 automatic retry on network errors.
   */
  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    retries = 1
  ): Promise<Response> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(url, { ...init, signal: controller.signal });
        return response;
      } catch (err: unknown) {
        const isLastAttempt = attempt === retries;
        if (isLastAttempt) throw err;
        // Wait 500ms before retry
        await new Promise((resolve) => setTimeout(resolve, 500));
      } finally {
        clearTimeout(timer);
      }
    }
    // Unreachable, but satisfies TypeScript
    throw new Error("fetch failed");
  }

  /**
   * Ping the PHP server to verify connectivity and HMAC authentication.
   * Used by the "Test Connection" button in Settings.
   */
  async ping(): Promise<{ success: boolean; message: string; server_time?: string }> {
    const url = new URL(this.baseUrl);
    url.searchParams.set("action", "ping");

    const headers = this.generateHmacHeaders("");
    const response = await this.fetchWithTimeout(url.toString(), {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`PHP Server responded with HTTP ${response.status}`);
    }

    const data = await response.json();
    return {
      success: Boolean(data?.success ?? true),
      message: data?.message || "Connection OK",
      server_time: data?.server_time,
    };
  }

  /**
   * Fetch available booking slots for a given date.
   * If no date provided, uses today's date.
   */
  async getAvailableSlots(date?: string): Promise<GetSlotsResponse> {
    const url = new URL(this.baseUrl);
    url.searchParams.set("action", "get_slots");
    if (date) url.searchParams.set("date", date);

    const headers = this.generateHmacHeaders("");
    const response = await this.fetchWithTimeout(url.toString(), {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PHP Booking API Error (${response.status}): ${errorText}`);
    }

    const data = await response.json() as GetSlotsResponse;
    // Guarantee slots is always an array even if PHP returns null
    return { ...data, slots: data.slots ?? [] };
  }

  /**
   * Request an SMS OTP for booking a slot via Instagram DM.
   */
  async requestBookingOtp(params: RequestOtpParams): Promise<RequestOtpResponse> {
    const url = new URL(this.baseUrl);
    url.searchParams.set("action", "request_otp");

    const bodyStr = JSON.stringify(params);
    const headers = this.generateHmacHeaders(bodyStr);

    const response = await this.fetchWithTimeout(url.toString(), {
      method: "POST",
      headers,
      body: bodyStr,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PHP Booking API Error (${response.status}): ${errorText}`);
    }

    return (await response.json()) as RequestOtpResponse;
  }

  /**
   * Confirm booking by verifying OTP and linking to CRM lead.
   */
  async confirmBooking(params: ConfirmBookingParams): Promise<ConfirmBookingResponse> {
    const url = new URL(this.baseUrl);
    url.searchParams.set("action", "confirm_booking");

    const bodyStr = JSON.stringify(params);
    const headers = this.generateHmacHeaders(bodyStr);

    const response = await this.fetchWithTimeout(url.toString(), {
      method: "POST",
      headers,
      body: bodyStr,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PHP Booking API Error (${response.status}): ${errorText}`);
    }

    return (await response.json()) as ConfirmBookingResponse;
  }

  /**
   * Sync a captured lead from OpenReply to the PHP CRM.
   * Works for both OTP-verified and direct (no-OTP) lead saves.
   */
  async syncLead(payload: SyncLeadDirectParams): Promise<{ success: boolean; crm_lead_id?: number; message?: string }> {
    const url = new URL(this.baseUrl);
    url.searchParams.set("action", "sync_lead");

    const bodyStr = JSON.stringify(payload);
    const headers = this.generateHmacHeaders(bodyStr);

    const response = await this.fetchWithTimeout(url.toString(), {
      method: "POST",
      headers,
      body: bodyStr,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PHP CRM Sync Error (${response.status}): ${errorText}`);
    }

    return (await response.json()) as { success: boolean; crm_lead_id?: number; message?: string };
  }

  /**
   * Generic HMAC Request executor for custom actions.
   */
  async request<T = unknown>(method: "GET" | "POST", payload: Record<string, unknown>): Promise<T> {
    const url = new URL(this.baseUrl);
    const action = (payload.action as string) || "default";
    url.searchParams.set("action", action);

    let bodyStr = "";
    if (method === "POST") {
      bodyStr = JSON.stringify(payload);
    } else {
      for (const [k, v] of Object.entries(payload)) {
        if (k !== "action" && v !== undefined) {
          url.searchParams.set(k, String(v));
        }
      }
    }

    const headers = this.generateHmacHeaders(bodyStr);
    const response = await this.fetchWithTimeout(url.toString(), {
      method,
      headers,
      body: method === "POST" ? bodyStr : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PHP API Error (${response.status}): ${errorText}`);
    }

    return (await response.json()) as T;
  }
}

/** Default singleton client using environment variables. */
export const phpBookingClient = new PhpBookingClient();
