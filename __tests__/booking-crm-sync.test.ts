import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PhpBookingClient } from "@/lib/services/php-booking-client";

describe("Booking CRM Bridge & Sync Engine", () => {
  const TEST_API_URL = "http://localhost/api_openreply.php";
  const TEST_SECRET = "test_crm_secret_key_123";

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.PHP_BOOKING_ENABLED = "true";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("generates correct HMAC-SHA256 headers matching PHP OpenReplyBridgeController", async () => {
    const client = new PhpBookingClient(TEST_API_URL, TEST_SECRET);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, message: "pong", api_version: "2.0.0" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const pingRes = await client.ping();
    expect(pingRes.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["X-Timestamp"]).toBeDefined();
    expect(headers["X-Signature"]).toBeDefined();
    expect(headers["Authorization"]).toBe(`Bearer ${TEST_SECRET}`);
    expect(headers["User-Agent"]).toBe("OpenReply-InstagramDM/2.0");
  });

  it("syncs captured lead to PHP CRM via syncLead endpoint", async () => {
    const client = new PhpBookingClient(TEST_API_URL, TEST_SECRET);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        waitlist_id: 101,
        crm_lead_id: 202,
        lead_score: 85,
        message: "لید با موفقیت در سیستم CRM ثبت و به کارشناس تخصیص یافت.",
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await client.syncLead({
      phone: "09123456789",
      full_name: "علی محمدی",
      instagram_handle: "ali_m",
      lead_source: "instagram_dm_ai",
      custom_data: { confidence: 0.98, owner: "SELF" },
    });

    expect(result.success).toBe(true);
    expect(result.crm_lead_id).toBe(202);
    expect(result.waitlist_id).toBe(101);

    const callArgs = mockFetch.mock.calls[0];
    const url = new URL(callArgs[0]);
    expect(url.searchParams.get("action")).toBe("sync_lead");

    const body = JSON.parse(callArgs[1].body);
    expect(body.phone).toBe("09123456789");
    expect(body.full_name).toBe("علی محمدی");
  });

  it("fetches available booking slots from PHP CRM", async () => {
    const client = new PhpBookingClient(TEST_API_URL, TEST_SECRET);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        date: "2026-11-05",
        is_working_day: true,
        total_slots: 2,
        slots: [
          {
            start_time: "10:00",
            end_time: "10:45",
            full_datetime: "2026-11-05 10:00:00",
            available: true,
            remaining_capacity: 1,
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const slots = await client.getAvailableSlots("2026-11-05");
    expect(slots.success).toBe(true);
    expect(slots.slots.length).toBe(1);
    expect(slots.slots[0].start_time).toBe("10:00");
  });

  it("handles standalone fallback when PHP_BOOKING_ENABLED is false", async () => {
    process.env.PHP_BOOKING_ENABLED = "false";
    const client = new PhpBookingClient(TEST_API_URL, TEST_SECRET);

    const pingRes = await client.ping();
    expect(pingRes.success).toBe(true);
    expect(pingRes.standalone_fallback).toBe(true);

    const slotsRes = await client.getAvailableSlots();
    expect(slotsRes.success).toBe(true);
    expect(slotsRes.message).toContain("مستقل");
  });

  it("trips circuit breaker on repeated network errors", async () => {
    const client = new PhpBookingClient(TEST_API_URL, TEST_SECRET, 100);

    const mockFetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    vi.stubGlobal("fetch", mockFetch);

    await expect(client.requestBookingOtp({ phone: "09123456789" })).rejects.toThrow("ECONNREFUSED");

    expect(client.isServerInCooldown()).toBe(true);
  });
});
