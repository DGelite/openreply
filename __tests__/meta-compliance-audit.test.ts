import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isWithin24HourWindow,
  isCommentWithin7DayWindow,
  redactSensitiveFinancialData,
  classifyProviderError,
} from "@/lib/meta/compliance";
import { isAccountInCooldown, clearAccountCooldown } from "@/lib/meta/circuit-breaker";
import { deliverPrivateReply } from "@/lib/queue/handlers/dm-delivery";
import { processResumeFlowNode } from "@/lib/automation/direct-message-processor";
import { providerManager } from "@/lib/providers/manager/provider-manager";
import { prisma } from "@/lib/db/client";

describe("Meta & Instagram Compliance Deep Audit Guard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("enforces strict 24-hour messaging window and 7-day private-reply comment window", () => {
    const now = Date.now();
    expect(isWithin24HourWindow(new Date(now - 2 * 60 * 60 * 1000), now)).toBe(true);
    expect(isWithin24HourWindow(new Date(now - 25 * 60 * 60 * 1000), now)).toBe(false);
    expect(isWithin24HourWindow(null, now)).toBe(false);

    expect(isCommentWithin7DayWindow(new Date(now - 3 * 24 * 60 * 60 * 1000), now)).toBe(true);
    expect(isCommentWithin7DayWindow(new Date(now - 8 * 24 * 60 * 60 * 1000), now)).toBe(false);
    expect(isCommentWithin7DayWindow(undefined, now)).toBe(true);
  });

  it("redacts 16-digit payment card numbers while preserving mobile phone numbers", () => {
    const validCard = "6037-9971-1234-5674"; // Valid Luhn 16-digit card
    const textWithCardAndPhone = `شماره کارت من ${validCard} و شماره موبایلم 09133702778 است.`;
    const res = redactSensitiveFinancialData(textWithCardAndPhone);

    expect(res.redacted).toBe(true);
    expect(res.sanitized).not.toContain("6037-9971-1234-5674");
    expect(res.sanitized).toContain("09133702778");

    const phoneOnly = "لطفاً با شماره 09133702778 تماس بگیرید";
    expect(redactSensitiveFinancialData(phoneOnly).redacted).toBe(false);
  });

  it("classifies BoxAPI/Meta 368 policy blocks and 429 rate limits and trips cooldown", () => {
    const accId = "ig_box_compliance_test";
    clearAccountCooldown(accId);

    const policyErr = classifyProviderError("Action blocked by Instagram (code 368)", accId);
    expect(policyErr?.name).toBe("PolicyBlockError");
    expect(isAccountInCooldown(accId).inCooldown).toBe(true);
    clearAccountCooldown(accId);

    const windowErr = classifyProviderError("This message is sent outside of allowed window.");
    expect(windowErr?.name).toBe("MessagingWindowExpiredError");
  });

  it("never calls sendTextMessage after privateReply on comment-triggered Flow Graph when 24h window is closed", async () => {
    vi.spyOn(prisma.conversationState, "findUnique").mockResolvedValue(null);
    vi.spyOn(prisma.conversationState, "upsert").mockResolvedValue({} as any);
    vi.spyOn(prisma.dmLog, "update").mockResolvedValue({} as any);
    vi.spyOn(prisma.leadTag, "findMany").mockResolvedValue([] as any);

    const privateReplySpy = vi.spyOn(providerManager, "privateReply").mockResolvedValue({
      success: true,
      provider: "BOXAPI",
      messageId: "pr_1",
      recipientId: "cmt_1",
      status: "SENT",
      timestamp: new Date(),
    });
    const sendTextSpy = vi.spyOn(providerManager, "sendTextMessage").mockResolvedValue({
      success: true,
      provider: "BOXAPI",
      messageId: "dm_1",
      recipientId: "user_1",
      status: "SENT",
      timestamp: new Date(),
    });

    await deliverPrivateReply({
      automation: {
        id: "auto_flow_qr",
        workspaceId: "ws_1",
        instagramAccountId: "ig_row_1",
        dmMessage: "",
        trackedLinks: [],
        instagramAccount: { id: "ig_row_1", instagramId: "ig_page_1" },
        flowGraph: {
          nodes: [
            {
              id: "trig",
              type: "trigger",
              position: { x: 0, y: 0 },
              data: {
                type: "trigger",
                config: { triggerType: "COMMENT_KEYWORD", keywords: ["122"], matchAnyWord: false },
              },
            },
            {
              id: "qr1",
              type: "quick_reply",
              position: { x: 0, y: 100 },
              data: {
                type: "quick_reply",
                config: {
                  message: "یه گزینه رو انتخاب کن:",
                  chips: [{ id: "c1", title: "گزینه ۱" }],
                },
              },
            },
            {
              id: "dm2",
              type: "send_dm",
              position: { x: 0, y: 200 },
              data: { type: "send_dm", config: { message: "پیام دوم نباید الان بره" } },
            },
          ],
          edges: [
            { id: "e1", sourceNodeId: "trig", targetNodeId: "qr1" },
            { id: "e2", sourceNodeId: "qr1", targetNodeId: "dm2" },
          ],
        },
      } as any,
      accessToken: "",
      commentId: "cmt_1",
      commenterId: "user_1",
      commenterName: "test_user",
      commentText: "122",
    });

    expect(privateReplySpy).toHaveBeenCalledTimes(1);
    expect(sendTextSpy).not.toHaveBeenCalled();
  });

  it("aborts smart_delay flow resumption without sending any DM if 24h window is closed", async () => {
    vi.spyOn(prisma.conversationState, "findUnique").mockResolvedValue({
      lastInteractedAt: new Date(Date.now() - 26 * 60 * 60 * 1000),
      isHumanHandover: false,
    } as any);
    const sendTextSpy = vi.spyOn(providerManager, "sendTextMessage");

    await processResumeFlowNode({
      instagramAccountId: "ig_page_1",
      userId: "user_expired",
      automationId: "auto_1",
      startNodeId: "node_2",
    });

    expect(sendTextSpy).not.toHaveBeenCalled();
  });
});
