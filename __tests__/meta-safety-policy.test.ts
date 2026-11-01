import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  isAccountInCooldown,
  tripAccountCooldown,
  clearAccountCooldown,
  getAllActiveCooldowns,
} from "@/lib/meta/circuit-breaker";
import {
  PolicyBlockError,
  RateLimitError,
  CommentAlreadyRepliedError,
  MessagingWindowExpiredError,
  UserUnreachableError,
  TokenExpiredError,
  sendPrivateReply,
  sendPrivateReplyWithButton,
  sendDirectMessage,
} from "@/lib/meta/client";
import {
  enrollUserInDrip,
  processDueDripEnrollments,
  resumeExpiredDripEnrollmentsForUser,
} from "@/lib/drip/drip-engine";
import { prisma } from "@/lib/db/client";

describe("Meta Graph API v25.0 Compliance & Safety Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Meta Account Circuit Breaker & Anti-Ban Cooldown", () => {
    it("should trip cooldown when an account encounters code 368 policy block", () => {
      const testAccountId = "test_ig_account_368";
      clearAccountCooldown(testAccountId);

      expect(isAccountInCooldown(testAccountId).inCooldown).toBe(false);

      // Trip circuit breaker
      tripAccountCooldown(testAccountId, "PolicyBlock (Code 368)", 1000);

      const status = isAccountInCooldown(testAccountId);
      expect(status.inCooldown).toBe(true);
      expect(status.remainingMs).toBeGreaterThan(0);
      expect(status.reason).toContain("368");
    });

    it("should auto-expire cooldown after time passes", async () => {
      const testAccountId = "test_ig_account_expire";
      tripAccountCooldown(testAccountId, "RateLimit", 50); // 50ms cooldown

      expect(isAccountInCooldown(testAccountId).inCooldown).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 60));

      expect(isAccountInCooldown(testAccountId).inCooldown).toBe(false);
    });

    it("should list active cooldowns", () => {
      const testAccountId = "test_ig_account_list";
      tripAccountCooldown(testAccountId, "Test Reason", 10000);

      const active = getAllActiveCooldowns();
      expect(active.some((e) => e.accountId === testAccountId)).toBe(true);
      clearAccountCooldown(testAccountId);
    });
  });

  describe("2. Meta Error Classes & Granular Subcodes", () => {
    it("should instantiate PolicyBlockError correctly", () => {
      const err = new PolicyBlockError("Temporary block", "trace_123");
      expect(err.code).toBe(368);
      expect(err.name).toBe("PolicyBlockError");
      expect(err.fbTraceId).toBe("trace_123");
    });

    it("should instantiate CommentAlreadyRepliedError with subcode 2534015", () => {
      const err = new CommentAlreadyRepliedError("Comment already replied");
      expect(err.code).toBe(100);
      expect(err.subcode).toBe(2534015);
      expect(err.name).toBe("CommentAlreadyRepliedError");
    });

    it("should instantiate MessagingWindowExpiredError with subcode 2534014", () => {
      const err = new MessagingWindowExpiredError(2534014, "Window expired");
      expect(err.code).toBe(100);
      expect(err.subcode).toBe(2534014);
      expect(err.name).toBe("MessagingWindowExpiredError");
    });

    it("should instantiate UserUnreachableError with subcode 2018001", () => {
      const err = new UserUnreachableError("User unreachable");
      expect(err.code).toBe(100);
      expect(err.subcode).toBe(2018001);
      expect(err.name).toBe("UserUnreachableError");
    });
  });

  describe("3. Drip Engine 24-Hour Messaging Policy Enforcement", () => {
    it("should pause drip enrollment if user has not interacted in the last 24 hours", async () => {
      const mockCampaign = {
        id: "drip_camp_24h",
        name: "VIP Offer",
        description: "Sequence",
        isActive: true,
        workspace: {
          instagramAccounts: [
            {
              id: "acc_1",
              instagramId: "ig_acc_24h",
              accessToken: "token_encrypted",
            },
          ],
        },
        steps: [
          {
            id: "step_1",
            stepOrder: 0,
            delayMinutes: 0,
            messageType: "TEXT",
            messageText: "Hello 24h expired user",
          },
        ],
      };

      const mockEnrollment = {
        id: "enroll_24h_1",
        campaignId: "drip_camp_24h",
        workspaceId: "ws_1",
        instagramAccountId: "ig_acc_24h",
        userId: "user_inactive_24h",
        currentStepIndex: 0,
        nextRunAt: new Date(Date.now() - 5000),
        status: "ACTIVE",
        campaign: mockCampaign,
      };

      // Mock DB responses
      vi.spyOn(prisma.dripEnrollment, "findMany").mockResolvedValueOnce([mockEnrollment as any]);
      vi.spyOn(prisma.dripEnrollment, "updateMany").mockResolvedValue({ count: 1 } as any);
      
      // Mock conversation state with lastInteractedAt 25 hours ago
      vi.spyOn(prisma.conversationState, "findUnique").mockResolvedValueOnce({
        id: "cs_1",
        workspaceId: "ws_1",
        instagramAccountId: "ig_acc_24h",
        userId: "user_inactive_24h",
        lastInteractedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
        step: "IDLE",
        isHumanHandover: false,
        handoverAt: null,
        automationId: null,
        activeFlowId: null,
        activeNodeId: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const updateSpy = vi.spyOn(prisma.dripEnrollment, "update").mockResolvedValue({} as any);

      const results = await processDueDripEnrollments(10);

      expect(results.length).toBe(1);
      expect(results[0].status).toBe("PAUSED_WINDOW_EXPIRED");
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "enroll_24h_1" },
          data: expect.objectContaining({
            status: "PAUSED",
          }),
        })
      );
    });

    it("should automatically resume expired drip enrollments when user sends a new message", async () => {
      const pausedEnrollment = {
        id: "enroll_paused_1",
        campaignId: "drip_camp_1",
        workspaceId: "ws_1",
        instagramAccountId: "ig_acc_1",
        userId: "user_resumed",
        currentStepIndex: 0,
        status: "PAUSED",
        lastError: "24-hour messaging window closed. Will auto-resume on next user DM.",
        campaign: {
          steps: [
            { id: "s1", delayMinutes: 5 },
          ],
        },
      };

      vi.spyOn(prisma.dripEnrollment, "findMany").mockResolvedValueOnce([pausedEnrollment as any]);
      const updateSpy = vi.spyOn(prisma.dripEnrollment, "update").mockResolvedValue({} as any);

      await resumeExpiredDripEnrollmentsForUser("ig_acc_1", "user_resumed");

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "enroll_paused_1" },
          data: expect.objectContaining({
            status: "ACTIVE",
            lastError: null,
          }),
        })
      );
    });
  });
});
