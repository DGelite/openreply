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

export interface LeadStatusResponse {
  success: boolean;
  found: boolean;
  waitlist_id?: number;
  full_name?: string;
  phone?: string;
  is_verified?: boolean;
  appointment_time?: string | null;
  crm_status?: string;
  assigned_agent_id?: number | null;
  message?: string;
}

/** Default connection timeout: 8 seconds. */
const DEFAULT_TIMEOUT_MS = 8000;
/** Cooldown period when PHP server fails completely: 60 seconds. */
const FAILURE_COOLDOWN_MS = 60_000;

/**
 * PhpBookingClient
 * Type-safe, Resilient TypeScript SDK connecting OpenReply to the PHP Booking & CRM system.
 *
 * Capabilities:
 * - Dual Authentication: HMAC-SHA256 (X-Signature + X-Timestamp) + Bearer Token
 * - Same-Server & Cross-Server Support (automatic localhost vs remote URL handling)
 * - Standalone Resilience: Zero-cost graceful degradation if PHP is offline or disabled
 * - Fast Circuit Breaker: Prevents hanging Instagram DMs when the remote server is down
 */
export class PhpBookingClient {
  private baseUrl: string;
  private apiSecret: string;
  private timeoutMs: number;
  private lastFailureTime = 0;
  private failureReason = "";

  constructor(
    baseUrl: string = process.env.BOOKING_API_URL || process.env.PHP_ADMIN_API_URL || "http://localhost/api_openreply.php",
    apiSecret: string = process.env.PHP_ADMIN_API_SECRET || "de_secure_api_key_2026_x892n3m",
    timeoutMs: number = DEFAULT_TIMEOUT_MS
  ) {
    if (!baseUrl || !baseUrl.startsWith("http")) {
      throw new Error(
        `PhpBookingClient: Invalid base URL "${baseUrl}". Set BOOKING_API_URL or PHP_ADMIN_API_URL in your .env file.`
      );
    }
    try {
      new URL(baseUrl);
    } catch {
      throw new Error(
        `PhpBookingClient: Malformed PHP Admin URL "${baseUrl}". Must be a full URL like http://localhost/api_openreply.php`
      );
    }

    this.baseUrl = baseUrl;
    this.apiSecret = apiSecret;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Check if integration is enabled via environment variable.
   */
  public isBridgeEnabled(): boolean {
    return process.env.PHP_BOOKING_ENABLED !== "false";
  }

  /**
   * Check if server is currently in circuit breaker cooldown.
   */
  public isServerInCooldown(): boolean {
    if (this.lastFailureTime === 0) return false;
    const elapsed = Date.now() - this.lastFailureTime;
    if (elapsed < FAILURE_COOLDOWN_MS) {
      return true;
    }
    // Cooldown expired
    this.lastFailureTime = 0;
    this.failureReason = "";
    return false;
  }

  private tripCooldown(reason: string) {
    this.lastFailureTime = Date.now();
    this.failureReason = reason;
    console.warn(`[PhpBookingClient] Circuit breaker tripped: ${reason}. Cooldown 60s.`);
  }

  /**
   * Generate HMAC-SHA256 authentication headers + Bearer fallback.
   */
  private generateHeaders(bodyStr: string): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = crypto
      .createHmac("sha256", this.apiSecret)
      .update(`${timestamp}.${bodyStr}`)
      .digest("hex");

    return {
      "Content-Type": "application/json; charset=utf-8",
      "X-Timestamp": timestamp,
      "X-Signature": signature,
      Authorization: `Bearer ${this.apiSecret}`,
      "User-Agent": "OpenReply-InstagramDM/2.0",
    };
  }

  /**
   * Execute fetch with timeout, circuit breaker check, and 1 retry.
   */
  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    retries = 1
  ): Promise<Response> {
    if (this.isServerInCooldown()) {
      throw new Error(`PHP Server in cooldown (${this.failureReason})`);
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(url, { ...init, signal: controller.signal });
        return response;
      } catch (err: unknown) {
        const isLastAttempt = attempt === retries;
        if (isLastAttempt) {
          this.tripCooldown(err instanceof Error ? err.message : "Network error");
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, 400));
      } finally {
        clearTimeout(timer);
      }
    }

    throw new Error("fetch failed");
  }

  /**
   * Ping the PHP server to verify connectivity and HMAC authentication.
   */
  async ping(): Promise<{
    success: boolean;
    message: string;
    server_time?: string;
    api_version?: string;
    latency_ms?: number;
    standalone_fallback?: boolean;
  }> {
    if (!this.isBridgeEnabled()) {
      return {
        success: true,
        message: "حالت مستقل فعال است (ارتباط با سیستم رزرو غیرفعال شده است).",
        standalone_fallback: true,
      };
    }

    const start = Date.now();
    try {
      const url = new URL(this.baseUrl);
      url.searchParams.set("action", "ping");

      const headers = this.generateHeaders("");
      const response = await this.fetchWithTimeout(url.toString(), {
        method: "GET",
        headers,
      });

      const latency_ms = Date.now() - start;

      if (!response.ok) {
        return {
          success: false,
          message: `خطای سرور PHP با کد وضعیت HTTP ${response.status}`,
          latency_ms,
        };
      }

      const data = (await response.json()) as any;
      return {
        success: Boolean(data?.success ?? true),
        message: data?.message || "ارتباط با سرور رزرو با موفقیت برقرار شد.",
        server_time: data?.server_time,
        api_version: data?.api_version,
        latency_ms,
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : "عدم امکان برقراری ارتباط با سرور رزرو",
        standalone_fallback: true,
      };
    }
  }

  /**
   * Fetch available booking slots for a given date.
   */
  async getAvailableSlots(date?: string): Promise<GetSlotsResponse> {
    const today = new Date().toISOString().slice(0, 10);
    const targetDate = date || today;

    if (!this.isBridgeEnabled() || this.isServerInCooldown()) {
      return {
        success: true,
        date: targetDate,
        is_working_day: true,
        total_slots: 0,
        slots: [],
        message: "سیستم رزرواسیون در حالت مستقل قرار دارد.",
      };
    }

    try {
      const url = new URL(this.baseUrl);
      url.searchParams.set("action", "get_slots");
      if (date) url.searchParams.set("date", date);

      const headers = this.generateHeaders("");
      const response = await this.fetchWithTimeout(url.toString(), {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`PHP Booking API Error (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as GetSlotsResponse;
      return { ...data, slots: data.slots ?? [] };
    } catch (err) {
      console.warn("[PhpBookingClient] getAvailableSlots fallback:", err);
      return {
        success: true,
        date: targetDate,
        is_working_day: true,
        total_slots: 0,
        slots: [],
        message: "حالت اضطراری مستقل (سرور رزرو موقتاً در دسترس نیست)",
      };
    }
  }

  /**
   * Request an SMS OTP for booking a slot via Instagram DM.
   */
  async requestBookingOtp(params: RequestOtpParams): Promise<RequestOtpResponse> {
    if (!this.isBridgeEnabled() || this.isServerInCooldown()) {
      return {
        success: false,
        waitlist_id: 0,
        phone: params.phone,
        sms_sent: false,
        message: "سیستم ارسال کد تایید موقتاً در دسترس نیست.",
      };
    }

    const url = new URL(this.baseUrl);
    url.searchParams.set("action", "request_otp");

    const bodyStr = JSON.stringify(params);
    const headers = this.generateHeaders(bodyStr);

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
    const headers = this.generateHeaders(bodyStr);

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
   * Sync a captured lead from OpenReply to the PHP CRM (Direct sync without OTP).
   */
  async syncLead(payload: SyncLeadDirectParams): Promise<{
    success: boolean;
    crm_lead_id?: number;
    waitlist_id?: number;
    lead_score?: number;
    message?: string;
  }> {
    if (!this.isBridgeEnabled() || this.isServerInCooldown()) {
      return {
        success: true,
        message: "لید در سیستم مستقل OpenReply ثبت گردید (پل غیرفعال یا در حالت بازگشتی)",
      };
    }

    try {
      const url = new URL(this.baseUrl);
      url.searchParams.set("action", "sync_lead");

      const bodyStr = JSON.stringify(payload);
      const headers = this.generateHeaders(bodyStr);

      const response = await this.fetchWithTimeout(url.toString(), {
        method: "POST",
        headers,
        body: bodyStr,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`PHP CRM Sync Error (${response.status}): ${errorText}`);
      }

      return (await response.json()) as {
        success: boolean;
        crm_lead_id?: number;
        waitlist_id?: number;
        lead_score?: number;
        message?: string;
      };
    } catch (err) {
      console.warn("[PhpBookingClient] syncLead offline fallback:", err);
      return {
        success: true,
        message: "ثبت محلی در دیتابیس OpenReply بدون تاخیر",
      };
    }
  }

  /**
   * Query status of an appointment or lead.
   */
  async getLeadStatus(params: { phone?: string; waitlist_id?: number }): Promise<LeadStatusResponse> {
    const url = new URL(this.baseUrl);
    url.searchParams.set("action", "get_lead_status");
    if (params.phone) url.searchParams.set("phone", params.phone);
    if (params.waitlist_id) url.searchParams.set("waitlist_id", String(params.waitlist_id));

    const headers = this.generateHeaders("");
    const response = await this.fetchWithTimeout(url.toString(), {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PHP Lead Status Error (${response.status}): ${errorText}`);
    }

    return (await response.json()) as LeadStatusResponse;
  }

  /**
   * Cancel an appointment via Instagram DM.
   */
  async cancelBooking(params: { phone?: string; waitlist_id?: number }): Promise<{ success: boolean; message: string }> {
    const url = new URL(this.baseUrl);
    url.searchParams.set("action", "cancel_booking");

    const bodyStr = JSON.stringify(params);
    const headers = this.generateHeaders(bodyStr);

    const response = await this.fetchWithTimeout(url.toString(), {
      method: "POST",
      headers,
      body: bodyStr,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PHP Cancel Booking Error (${response.status}): ${errorText}`);
    }

    return (await response.json()) as { success: boolean; message: string };
  }

  /**
   * Generic Request executor.
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

    const headers = this.generateHeaders(bodyStr);
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
