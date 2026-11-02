import { describe, it, expect, beforeEach, vi } from "vitest";
import { providerManager } from "@/lib/providers/manager/provider-manager";
import { BoxApiClient } from "@/lib/providers/boxapi/boxapi-client";
import { verifyBoxApiWebhookSignature } from "@/lib/providers/boxapi/webhook-verifier";
import {
  parseBoxApiCommentEvents,
  parseBoxApiDirectMessageEvents,
  parseBoxApiPostbackEvents,
} from "@/lib/providers/boxapi/webhook-parser";
import {
  ProviderAuthExpiredError,
  ProviderPolicyBlockError,
  ProviderRateLimitError,
  ProviderTimeoutError,
} from "@/lib/providers/errors/provider-errors";
import { validateEmail, validatePhone } from "@/lib/automation/email-phone-collector";
import { evaluateConditionNode } from "@/lib/flow/flow-engine";
import type { FlowNode } from "@/lib/flow/types";
import crypto from "crypto";

describe("OpenReply Multi-Provider & BoxAPI Enterprise Test Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. BoxAPI Webhook HMAC Signature Verification & Anti-Replay", () => {
    const secret = "test_box_webhook_secret_key_12345";
    const body = JSON.stringify({
      event_type: "comment",
      account_id: "account_uuid_123",
      data: {
        id: "comment_998877",
        from: { id: "user_5544", username: "boxuser" },
        text: "قیمت لطفا",
      },
    });

    it("should accept valid HMAC-SHA256 signature within 5-minute replay window", () => {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const hash = crypto
        .createHmac("sha256", secret)
        .update(`${timestamp}.${body}`)
        .digest("hex");
      const signatureHeader = `sha256=${hash}`;

      const result = verifyBoxApiWebhookSignature(body, signatureHeader, timestamp, secret);

      expect(result.isValid).toBe(true);
    });

    it("should reject invalid HMAC signature", () => {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signatureHeader = "sha256=" + "a".repeat(64);

      const result = verifyBoxApiWebhookSignature(body, signatureHeader, timestamp, secret);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Signature mismatch");
    });

    it("should reject replayed webhook if older than 5 minutes", () => {
      const oldTimestamp = String(Math.floor(Date.now() / 1000) - 400); // 400s ago (> 300s window)
      const hash = crypto
        .createHmac("sha256", secret)
        .update(`${oldTimestamp}.${body}`)
        .digest("hex");
      const signatureHeader = `sha256=${hash}`;

      const result = verifyBoxApiWebhookSignature(body, signatureHeader, oldTimestamp, secret);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("replay window");
    });
  });

  describe("2. BoxAPI Webhook Normalization & Event Extraction", () => {
    it("should normalize BoxAPI comment webhook into standard InboundCommentEvent DTO", () => {
      const payload = {
        event_id: "evt_101",
        event_type: "comment",
        account_id: "account_uuid_100",
        data: {
          id: "comment_12345",
          text: "سفارش دارم",
          from: { id: "user_888", username: "customer1" },
          media: { id: "media_post_777" },
        },
      };

      const events = parseBoxApiCommentEvents(payload);
      expect(events).toHaveLength(1);
      expect(events[0].commentId).toBe("comment_12345");
      expect(events[0].commentText).toBe("سفارش دارم");
      expect(events[0].commenterId).toBe("user_888");
      expect(events[0].commenterName).toBe("customer1");
      expect(events[0].mediaId).toBe("media_post_777");
      expect(events[0].boxAccountId).toBe("account_uuid_100");
    });

    it("should normalize BoxAPI direct message webhook into InboundDirectMessageEvent DTO", () => {
      const payload = {
        event_id: "evt_102",
        event_type: "messaging",
        account_id: "account_uuid_100",
        data: {
          sender: { id: "dm_user_99" },
          recipient: { id: "account_uuid_100" },
          message: {
            mid: "mid_box_999",
            text: "سلام کاتالوگ لطفا",
            is_echo: false,
          },
        },
      };

      const events = parseBoxApiDirectMessageEvents(payload);
      expect(events).toHaveLength(1);
      expect(events[0].userId).toBe("dm_user_99");
      expect(events[0].messageText).toBe("سلام کاتالوگ لطفا");
      expect(events[0].mid).toBe("mid_box_999");
      expect(events[0].boxAccountId).toBe("account_uuid_100");
    });

    it("should parse BoxAPI postback webhook button clicks", () => {
      const payload = {
        event_id: "evt_103",
        event_type: "messaging",
        account_id: "account_uuid_100",
        data: {
          sender: { id: "user_tap_1" },
          recipient: { id: "account_uuid_100" },
          postback: {
            payload: "reveal:auto_123",
            title: "دریافت فایل",
          },
        },
      };

      const events = parseBoxApiPostbackEvents(payload);
      expect(events).toHaveLength(1);
      expect(events[0].userId).toBe("user_tap_1");
      expect(events[0].payload).toBe("reveal:auto_123");
    });
  });

  describe("3. Error Classification & Provider Resiliency", () => {
    it("should mark PolicyBlock (Code 368) as failover-eligible", () => {
      const err = new ProviderPolicyBlockError("META", "Action blocked under policy 368");
      expect(err.provider).toBe("META");
      expect(err.category).toBe("POLICY_368");
      expect(err.isFailoverEligible).toBe(true);
      expect(err.statusCode).toBe(403);
    });

    it("should mark RateLimit as failover-eligible with retry backoff", () => {
      const err = new ProviderRateLimitError("META", "Rate limited", 120000);
      expect(err.category).toBe("RATE_LIMIT");
      expect(err.isFailoverEligible).toBe(true);
      expect(err.retryAfterMs).toBe(120000);
    });

    it("should mark Timeout as failover-eligible", () => {
      const err = new ProviderTimeoutError("META", "Meta connection timed out");
      expect(err.category).toBe("TIMEOUT");
      expect(err.isFailoverEligible).toBe(true);
    });

    it("should mark Auth Expired as failover-eligible to backup provider", () => {
      const err = new ProviderAuthExpiredError("META", "Token expired or revoked");
      expect(err.category).toBe("AUTH_EXPIRED");
      expect(err.isFailoverEligible).toBe(true);
    });
  });

  describe("4. Visual Flow Engine Multi-Provider Node Evaluation", () => {
    it("should correctly evaluate is_following condition when true", () => {
      const node: FlowNode = {
        id: "cond_follow",
        title: "Check Follower",
        type: "condition",
        position: { x: 0, y: 0 },
        data: {
          type: "condition",
          config: {
            variable: "is_following",
            operator: "equals",
          },
        },
      };

      const result = evaluateConditionNode(node, {
        workspaceId: "ws_1",
        instagramAccountId: "acc_1",
        userId: "user_1",
        isFollowing: true,
      });

      expect(result).toBe(true);
    });

    it("should correctly evaluate is_following condition when false", () => {
      const node: FlowNode = {
        id: "cond_follow",
        title: "Check Follower",
        type: "condition",
        position: { x: 0, y: 0 },
        data: {
          type: "condition",
          config: {
            variable: "is_following",
            operator: "equals",
          },
        },
      };

      const result = evaluateConditionNode(node, {
        workspaceId: "ws_1",
        instagramAccountId: "acc_1",
        userId: "user_1",
        isFollowing: false,
      });

      expect(result).toBe(false);
    });
  });

  describe("5. Lead Validation & Iranian Data Integrity", () => {
    it("should validate Iranian mobile phone numbers in multiple formats", () => {
      expect(validatePhone("09123456789")).toBe(true);
      expect(validatePhone("09901234567")).toBe(true);
      expect(validatePhone("+989123456789")).toBe(true);
      expect(validatePhone("02188888888")).toBe(false);
      expect(validatePhone("12345")).toBe(false);
      expect(validatePhone("invalid_phone")).toBe(false);
    });

    it("should validate standard email addresses", () => {
      expect(validateEmail("user@example.com")).toBe(true);
      expect(validateEmail("contact@digitalelite.ir")).toBe(true);
      expect(validateEmail("invalid-email-address")).toBe(false);
      expect(validateEmail("")).toBe(false);
    });
  });
});
