import { describe, it, expect, vi, beforeEach } from "vitest";
import { phpBookingClient } from "@/lib/services/php-booking-client";
import { syncLeadToWampCrm } from "@/lib/automation/crm-sync";
import { deliverPrivateReply } from "@/lib/queue/handlers/dm-delivery";
import { processLeadStep, buildMergedLeadCompletionText } from "@/lib/automation/email-phone-collector";
import { providerManager } from "@/lib/providers/manager/provider-manager";
import { prisma } from "@/lib/db/client";
import {
  parseBoxApiDirectMessageEvents,
  parseBoxApiPostbackEvents,
} from "@/lib/providers/boxapi/webhook-parser";

describe("Campaign Lead Capture Form & Instant Booking Bridge", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("passes auto_verify_and_book flag correctly when syncing to PHP CRM", async () => {
    const syncSpy = vi.spyOn(phpBookingClient, "syncLead").mockResolvedValue({
      success: true,
      crm_lead_id: 888,
      waitlist_id: 999,
      lead_score: 15,
      message: "Lead verified and appointment booked",
    });

    const result = await syncLeadToWampCrm({
      leadId: "lead_test_auto_verify",
      phone: "09121112233",
      full_name: "مخاطب تست رزرو فوری",
      username: "test_ig_user",
      auto_verify_and_book: true,
      appointment_time: "2026-11-25 14:00:00",
    });

    expect(result).toBe(true);
    expect(syncSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "09121112233",
        full_name: "مخاطب تست رزرو فوری",
        auto_verify_and_book: true,
        appointment_time: "2026-11-25 14:00:00",
      })
    );
  });

  it("supports syncing name-only leads with auto_verify_and_book", async () => {
    const syncSpy = vi.spyOn(phpBookingClient, "syncLead").mockResolvedValue({
      success: true,
      crm_lead_id: 889,
      waitlist_id: 1000,
      lead_score: 5,
      message: "Name-only lead synced",
    });

    const result = await syncLeadToWampCrm({
      leadId: "lead_name_only",
      full_name: "فقط نام کاربر",
      username: "name_user",
      auto_verify_and_book: true,
    });

    expect(result).toBe(true);
    expect(syncSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        full_name: "فقط نام کاربر",
        auto_verify_and_book: true,
      })
    );
  });

  it("supports syncing phone-only leads with auto_verify_and_book", async () => {
    const syncSpy = vi.spyOn(phpBookingClient, "syncLead").mockResolvedValue({
      success: true,
      crm_lead_id: 890,
      waitlist_id: 1001,
      lead_score: 10,
      message: "Phone-only lead synced",
    });

    const result = await syncLeadToWampCrm({
      leadId: "lead_phone_only",
      phone: "09351234567",
      username: "phone_user",
      auto_verify_and_book: false,
    });

    expect(result).toBe(true);
    expect(syncSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "09351234567",
        auto_verify_and_book: false,
      })
    );
  });

  it("sends leadPromptName via single privateReply when both Lead Form and dmMessage are enabled on comment trigger", async () => {
    const privateReplySpy = vi.spyOn(providerManager, "privateReply").mockResolvedValue({
      success: true,
      provider: "BOXAPI",
      messageId: "msg_pr_1",
      recipientId: "user_commenter_122",
      status: "SENT",
      timestamp: new Date(),
    });
    const sendTextSpy = vi.spyOn(providerManager, "sendTextMessage").mockResolvedValue({
      success: true,
      provider: "BOXAPI",
      messageId: "msg_txt_1",
      recipientId: "user_commenter_122",
      status: "SENT",
      timestamp: new Date(),
    });
    vi.spyOn(prisma.dmLog, "update").mockResolvedValue({} as any);
    const convUpsertSpy = vi.spyOn(prisma.conversationState, "upsert").mockResolvedValue({} as any);

    await deliverPrivateReply({
      automation: {
        id: "auto_122",
        workspaceId: "ws_1",
        instagramAccountId: "ig_row_1",
        dmMessage: "ممنون از شما",
        openingDmEnabled: false,
        collectName: true,
        collectPhone: true,
        leadPromptName: "لطفاً نام و نام خانوادگی خود را وارد کنید:",
        leadPromptPhone: "لطفاً شماره همراه خود را وارد کنید:",
        trackedLinks: [],
        instagramAccount: {
          id: "ig_row_1",
          instagramId: "17841401025517140",
        },
      } as any,
      accessToken: "",
      commentId: "cmt_122",
      commenterId: "user_commenter_122",
      commenterName: "armin.reel",
      commentText: "122",
    });

    // Must use the single privateReply slot for the form prompt, NOT dmMessage
    expect(privateReplySpy).toHaveBeenCalledTimes(1);
    expect(privateReplySpy).toHaveBeenCalledWith(
      "ig_row_1",
      "cmt_122",
      "لطفاً نام و نام خانوادگی خود را وارد کنید:"
    );
    // Must NOT fire sendTextMessage before user replies (outside 24h window)
    expect(sendTextSpy).not.toHaveBeenCalled();
    expect(convUpsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ step: "AWAITING_NAME" }),
        update: expect.objectContaining({ step: "AWAITING_NAME" }),
      })
    );
  });

  it("parses BoxAPI messaging_quick_replies and messaging_postbacks webhooks correctly", () => {
    const qrEvents = parseBoxApiDirectMessageEvents({
      event_id: "evt_qr_1",
      event_type: "messaging_quick_replies",
      account_id: "box_acc_1",
      data: {
        sender: { id: "user_123" },
        recipient: { id: "ig_456" },
        timestamp: 1700000000,
        message: {
          mid: "mid_qr_1",
          text: "✅ تایید",
          quick_reply: { payload: "CONFIRM_LEAD_YES" },
        },
      },
    });

    expect(qrEvents).toHaveLength(1);
    expect(qrEvents[0]).toMatchObject({
      boxAccountId: "box_acc_1",
      userId: "user_123",
      messageText: "✅ تایید",
      quickReplyPayload: "CONFIRM_LEAD_YES",
    });

    const pbEvents = parseBoxApiPostbackEvents({
      event_id: "evt_pb_1",
      event_type: "messaging_postbacks",
      account_id: "box_acc_1",
      data: {
        sender: { id: "user_123" },
        recipient: { id: "ig_456" },
        postback: {
          mid: "mid_pb_1",
          title: "مشاهده لینک",
          payload: "REVEAL_LINK",
        },
      },
    });

    expect(pbEvents).toHaveLength(1);
    expect(pbEvents[0]).toMatchObject({
      boxAccountId: "box_acc_1",
      userId: "user_123",
      payload: "REVEAL_LINK",
    });
  });

  it("refuses to save numeric keyword '122' as lead name during AWAITING_NAME step", async () => {
    const leadUpsertSpy = vi.spyOn(prisma.lead, "upsert").mockResolvedValue({} as any);
    const convUpsertSpy = vi.spyOn(prisma.conversationState, "upsert").mockResolvedValue({} as any);
    vi.spyOn(prisma.automation, "findUnique").mockResolvedValue({
      id: "auto_122",
      collectName: true,
      collectPhone: true,
      singleStepLeadCapture: false,
    } as any);
    vi.spyOn(prisma.conversationState, "findUnique").mockResolvedValue({
      metadata: {},
    } as any);
    vi.spyOn(prisma.aiConfig, "findUnique").mockResolvedValue({
      isEnabled: false,
      safetySettings: { leadNormalizer: { enabled: false } },
    } as any);

    const res = await processLeadStep({
      workspaceId: "ws_1",
      instagramAccountId: "ig_1",
      userId: "user_1",
      userMessage: "122",
      currentStep: "AWAITING_NAME",
      automationId: "auto_122",
    });

    expect(res.success).toBe(false);
    expect(res.nextStep).toBe("AWAITING_NAME");
    expect(leadUpsertSpy).not.toHaveBeenCalled();
    expect(convUpsertSpy).not.toHaveBeenCalled();
  });

  it("marks DmLog FAILED instead of SENT when flowGraph produces zero outbound messages", async () => {
    const dmLogUpdateSpy = vi.spyOn(prisma.dmLog, "update").mockResolvedValue({} as any);
    vi.spyOn(prisma.conversationState, "findUnique").mockResolvedValue(null);
    vi.spyOn(prisma.leadTag, "findMany").mockResolvedValue([] as any);
    const privateReplySpy = vi.spyOn(providerManager, "privateReply");

    await deliverPrivateReply({
      automation: {
        id: "auto_mismatch",
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
                config: { triggerType: "COMMENT_KEYWORD", keywords: ["قیمت"], matchAnyWord: false },
              },
            },
            {
              id: "dm1",
              type: "send_dm",
              position: { x: 0, y: 100 },
              data: { type: "send_dm", config: { message: "قیمت محصول" } },
            },
          ],
          edges: [{ id: "e1", sourceNodeId: "trig", targetNodeId: "dm1" }],
        },
      } as any,
      accessToken: "",
      commentId: "cmt_mismatch",
      commenterId: "user_1",
      commenterName: "test_user",
      commentText: "122",
    });

    expect(privateReplySpy).not.toHaveBeenCalled();
    expect(dmLogUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED" }),
      })
    );
  });

  it("still asks for phone on a new form even if the user had an older verified phone in Lead table", async () => {
    vi.spyOn(prisma.aiConfig, "findUnique").mockResolvedValue({
      isEnabled: false,
      safetySettings: { leadNormalizer: { enabled: false } },
    } as any);
    vi.spyOn(prisma.lead, "upsert").mockResolvedValue({
      id: "lead_1",
      name: "آرمین طهماسبی",
      phone: "09133702778",
      phoneVerified: true, // Old phone from earlier campaign/test
    } as any);
    vi.spyOn(prisma.automation, "findUnique").mockResolvedValue({
      id: "auto_1",
      collectName: true,
      collectPhone: true,
      leadPromptPhone: "لطفاً شماره‌تون رو بفرستید 📱",
    } as any);
    vi.spyOn(prisma.conversationState, "findUnique").mockResolvedValue({
      metadata: {}, // Current form did NOT capture phone yet
    } as any);
    vi.spyOn(prisma.conversationState, "upsert").mockResolvedValue({} as any);

    const res = await processLeadStep({
      workspaceId: "ws_1",
      instagramAccountId: "ig_1",
      userId: "user_1",
      userMessage: "آرمین طهماسبی",
      currentStep: "AWAITING_NAME",
      automationId: "auto_1",
    });

    expect(res.success).toBe(true);
    expect(res.nextStep).toBe("AWAITING_PHONE");
    expect(res.replyMessage).toBe("لطفاً شماره‌تون رو بفرستید 📱");
  });

  it("sends leadPromptBoth in single-step mode when both collectName and collectPhone and singleStepLeadCapture are enabled", async () => {
    const privateReplySpy = vi.spyOn(providerManager, "privateReply").mockResolvedValue({
      success: true,
      provider: "BOXAPI",
      messageId: "msg_pr_both",
      recipientId: "user_both",
      status: "SENT",
      timestamp: new Date(),
    });
    vi.spyOn(prisma.dmLog, "update").mockResolvedValue({} as any);
    const convUpsertSpy = vi.spyOn(prisma.conversationState, "upsert").mockResolvedValue({} as any);

    await deliverPrivateReply({
      automation: {
        id: "auto_single_step",
        workspaceId: "ws_1",
        instagramAccountId: "ig_row_1",
        dmMessage: "لینک آماده شد",
        openingDmEnabled: false,
        collectName: true,
        collectPhone: true,
        singleStepLeadCapture: true,
        leadPromptBoth: "سلام! اسم و شماره موبایلت رو توی یه پیام بفرست 🙏",
        leadPromptName: "اسم چیه؟",
        leadPromptPhone: "شماره چنده؟",
        trackedLinks: [],
        instagramAccount: {
          id: "ig_row_1",
          instagramId: "17841401025517140",
        },
      } as any,
      accessToken: "",
      commentId: "cmt_single",
      commenterId: "user_both",
      commenterName: "armin.test",
      commentText: "122",
    });

    expect(privateReplySpy).toHaveBeenCalledWith(
      "ig_row_1",
      "cmt_single",
      "سلام! اسم و شماره موبایلت رو توی یه پیام بفرست 🙏"
    );
    expect(convUpsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          step: "AWAITING_NAME",
          metadata: { singleStepLead: true },
        }),
        update: expect.objectContaining({
          step: "AWAITING_NAME",
          metadata: { singleStepLead: true },
        }),
      })
    );
  });

  it("still asks ONLY phone when collectName is unchecked even if singleStepLeadCapture is true", async () => {
    const privateReplySpy = vi.spyOn(providerManager, "privateReply").mockResolvedValue({
      success: true,
      provider: "BOXAPI",
      messageId: "msg_pr_phone_only",
      recipientId: "user_phone_only",
      status: "SENT",
      timestamp: new Date(),
    });
    vi.spyOn(prisma.dmLog, "update").mockResolvedValue({} as any);
    const convUpsertSpy = vi.spyOn(prisma.conversationState, "upsert").mockResolvedValue({} as any);

    await deliverPrivateReply({
      automation: {
        id: "auto_phone_only",
        workspaceId: "ws_1",
        instagramAccountId: "ig_row_1",
        dmMessage: "لینک",
        openingDmEnabled: false,
        collectName: false,
        collectPhone: true,
        singleStepLeadCapture: true,
        leadPromptPhone: "فقط شماره‌تون رو بفرستید 📱",
        leadPromptBoth: "اسم و شماره بفرستید",
        trackedLinks: [],
        instagramAccount: {
          id: "ig_row_1",
          instagramId: "17841401025517140",
        },
      } as any,
      accessToken: "",
      commentId: "cmt_phone_only",
      commenterId: "user_phone_only",
      commenterName: "phone_tester",
      commentText: "122",
    });

    expect(privateReplySpy).toHaveBeenCalledWith(
      "ig_row_1",
      "cmt_phone_only",
      "فقط شماره‌تون رو بفرستید 📱"
    );
    expect(convUpsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ step: "AWAITING_PHONE", metadata: {} }),
        update: expect.objectContaining({ step: "AWAITING_PHONE", metadata: {} }),
      })
    );
  });

  it("completes single-step form in 1 message when user sends both name and phone together", async () => {
    vi.spyOn(prisma.aiConfig, "findUnique").mockResolvedValue({
      isEnabled: false,
      safetySettings: { leadNormalizer: { enabled: false } },
    } as any);
    vi.spyOn(prisma.automation, "findUnique").mockResolvedValue({
      id: "auto_single",
      name: "تست تک‌مرحله‌ای",
      collectName: true,
      collectPhone: true,
      singleStepLeadCapture: true,
      leadSuccessMessage: "ثبت نهایی انجام شد 🙏",
    } as any);
    vi.spyOn(prisma.conversationState, "findUnique").mockResolvedValue({
      metadata: { singleStepLead: true },
    } as any);
    const leadUpsertSpy = vi.spyOn(prisma.lead, "upsert").mockResolvedValue({
      id: "lead_1",
      name: "آرمین طهماسبی",
      phone: "09133702778",
      phoneVerified: true,
    } as any);
    vi.spyOn(prisma.conversationState, "upsert").mockResolvedValue({} as any);
    const syncSpy = vi.spyOn(phpBookingClient, "syncLead").mockResolvedValue({
      success: true,
      crm_lead_id: 901,
    } as any);

    const res = await processLeadStep({
      workspaceId: "ws_1",
      instagramAccountId: "ig_1",
      userId: "user_1",
      userMessage: "آرمین طهماسبی 09133702778",
      currentStep: "AWAITING_NAME",
      automationId: "auto_single",
    });

    expect(res.success).toBe(true);
    expect(res.nextStep).toBe("COMPLETED");
    expect(res.replyMessage).toBe("ثبت نهایی انجام شد 🙏");
    expect(leadUpsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          name: "آرمین طهماسبی",
          phone: "09133702778",
          phoneVerified: true,
        }),
      })
    );
    expect(syncSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        full_name: "آرمین طهماسبی",
        phone: "09133702778",
      })
    );
  });

  it("merges leadSuccessMessage and campaign dmMessage cleanly into 1 message bubble", () => {
    const merged = buildMergedLeadCompletionText({
      successMessage: "عالیه! شماره‌تون با موفقیت ثبت شد، خیلی زود باهاتون تماس می‌گیریم 🙏",
      dmMessage: "سلام! لینک درخواست‌شده برای شما ارسال شد 🙏",
    });

    expect(merged).toBe(
      "عالیه! شماره‌تون با موفقیت ثبت شد، خیلی زود باهاتون تماس می‌گیریم 🙏\n\nسلام! لینک درخواست‌شده برای شما ارسال شد 🙏"
    );

    // Avoid duplicating identical texts
    const deduped = buildMergedLeadCompletionText({
      successMessage: "لینک آماده شد",
      dmMessage: "لینک آماده شد",
    });
    expect(deduped).toBe("لینک آماده شد");
  });
});
