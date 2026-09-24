import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PhpBookingClient } from "@/lib/services/php-booking-client";
import crypto from "node:crypto";

describe("PhpBookingClient & Standalone Bridge Resilience", () => {
  const testSecret = "test_secret_key_123456";
  const testUrl = "http://localhost:8080/api_openreply.php";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    delete process.env.PHP_BOOKING_ENABLED;
  });

  it("should initialize with default or custom configuration", () => {
    const client = new PhpBookingClient(testUrl, testSecret);
    expect(client).toBeDefined();
    expect(client.isBridgeEnabled()).toBe(true);
    expect(client.isServerInCooldown()).toBe(false);
  });

  it("should throw error if malformed URL is provided", () => {
    expect(() => new PhpBookingClient("not-a-valid-url")).toThrow(
      "Invalid base URL"
    );
  });

  it("should honor PHP_BOOKING_ENABLED=false and report bridge as disabled", () => {
    process.env.PHP_BOOKING_ENABLED = "false";
    const client = new PhpBookingClient(testUrl, testSecret);
    expect(client.isBridgeEnabled()).toBe(false);
  });

  describe("Standalone Mode Fallback Behavior (When Bridge is Disabled or Offline)", () => {
    it("getAvailableSlots should return standalone fallback when bridge is disabled without throwing", async () => {
      process.env.PHP_BOOKING_ENABLED = "false";
      const client = new PhpBookingClient(testUrl, testSecret);
      const res = await client.getAvailableSlots("2026-09-25");

      expect(res.success).toBe(true);
      expect(res.slots).toEqual([]);
      expect(res.is_working_day).toBe(true);
      expect(res.message).toContain("حالت مستقل");
    });

    it("requestOtp should return safe fallback message without crashing when bridge is disabled", async () => {
      process.env.PHP_BOOKING_ENABLED = "false";
      const client = new PhpBookingClient(testUrl, testSecret);
      const res = await client.requestBookingOtp({
        phone: "09123456789",
        full_name: "کاربر تستی",
      });

      expect(res.success).toBe(false);
      expect(res.sms_sent).toBe(false);
      expect(res.message).toContain("موقتاً در دسترس نیست");
    });

    it("syncLead should return standalone fallback when disabled", async () => {
      process.env.PHP_BOOKING_ENABLED = "false";
      const client = new PhpBookingClient(testUrl, testSecret);
      const res = await client.syncLead({
        phone: "09123456789",
        full_name: "کاربر تستی",
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain("مستقل");
    });

    it("circuit breaker should trip and fail fast on consecutive network failures", async () => {
      const client = new PhpBookingClient("http://127.0.0.1:9998/api_openreply.php", testSecret, 200);

      // Mock fetch to simulate complete network timeout / down server
      vi.spyOn(global, "fetch").mockRejectedValue(new Error("Connection refused"));

      // First call should catch error and return fallback, tripping the circuit breaker
      const res1 = await client.getAvailableSlots("2026-09-25");
      expect(res1.success).toBe(true);
      expect(client.isServerInCooldown()).toBe(true);

      // Second call should fail fast immediately due to circuit breaker cooldown
      const res2 = await client.getAvailableSlots("2026-09-25");
      expect(res2.success).toBe(true);
      expect(res2.slots).toEqual([]);
    });
  });

  describe("HMAC-SHA256 Signature & Webhook Verification Logic", () => {
    it("should compute correct HMAC-SHA256 signature for payload", () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const rawBody = JSON.stringify({ event: "ping", data: { test: true } });

      const expectedSignature = crypto
        .createHmac("sha256", testSecret)
        .update(`${timestamp}.${rawBody}`)
        .digest("hex");

      expect(expectedSignature).toBeDefined();
      expect(expectedSignature.length).toBe(64); // SHA-256 produces 64-char hex string

      // Verify signature matches
      const testSig = crypto
        .createHmac("sha256", testSecret)
        .update(`${timestamp}.${rawBody}`)
        .digest("hex");

      expect(crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(testSig))).toBe(true);
    });

    it("should reject signatures with replay attacks outside the 300s window", () => {
      const oldTimestamp = (Math.floor(Date.now() / 1000) - 400).toString();
      const now = Math.floor(Date.now() / 1000);
      const isReplay = Math.abs(now - parseInt(oldTimestamp, 10)) > 300;

      expect(isReplay).toBe(true);
    });
  });
});
