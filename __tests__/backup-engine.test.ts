import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isPhoneGroundedInInput,
  classifyBackupIntent,
  buildBackupCommentReply,
  buildBackupSmartResponse,
} from "@/lib/ai/backup-engine";
import { generateSmartResponse } from "@/lib/ai/features/smart-responses";
import { generateAiReply } from "@/lib/ai/features/ai-replies";
import { processAiComment } from "@/lib/ai/features/ai-comments";
import { classifyIntent, clearIntentCache } from "@/lib/ai/features/intent-recognition";

vi.mock("@/lib/ai/factory", () => ({
  getAiEngine: vi.fn().mockRejectedValue(new Error("Gemini API Error 503: Service Unavailable")),
}));

vi.mock("@/lib/ai/features/knowledge-base", () => ({
  queryKnowledgeBase: vi.fn().mockResolvedValue([
    { content: "هزینه پکیج جامع آموزش اینستاگرام ۲ میلیون تومان است." },
  ]),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    aiConfig: {
      findUnique: vi.fn().mockResolvedValue({
        isEnabled: true,
        offlineMessage: null,
        confidenceThreshold: 0.75,
        manualApprovalMode: false,
      }),
    },
    lead: { findFirst: vi.fn().mockResolvedValue({ name: "سارا", phone: null }) },
    aiConversationMemory: { findMany: vi.fn().mockResolvedValue([]) },
    conversationState: { findFirst: vi.fn().mockResolvedValue(null) },
    aiAuditLog: { create: vi.fn().mockResolvedValue({ id: "audit_1" }) },
  },
}));

describe("AI Deterministic Backup Engine & Phone Grounding Guard", () => {
  beforeEach(() => {
    clearIntentCache();
  });

  it("verifies strict digit grounding to prevent any phone hallucination", () => {
    expect(isPhoneGroundedInInput("09133702778", "شماره من ۰۹۱۳ ۳۷۰ ۲۷۷۸ هست")).toBe(true);
    expect(isPhoneGroundedInInput("09133702778", "+98 913-370-2778")).toBe(true);
    expect(isPhoneGroundedInInput("09133702779", "شماره من 09133702778 هست")).toBe(false);
    expect(isPhoneGroundedInInput("09123456789", "سلام آرمین طهماسبی")).toBe(false);
  });

  it("classifies intents cleanly via backup engine when AI is unreachable", async () => {
    const res = await classifyIntent("ws_backup", "بسته دستم رسیده خرابه و میخوام پولم رو پس بگیرم");
    expect(res.primaryIntent).toBe("REFUND");
    expect(res.reasoning).toContain("Backup engine");
  });

  it("returns a KB-aware Persian reply from generateSmartResponse when AI throws 503", async () => {
    const reply = await generateSmartResponse({
      workspaceId: "ws_backup",
      userId: "user_1",
      userMessage: "قیمت پکیج چنده؟",
    });

    expect(reply).toContain("سارا جان");
    expect(reply).toContain("هزینه پکیج جامع");
  });

  it("returns a clean backup DM reply from generateAiReply when AI throws 503", async () => {
    const res = await generateAiReply({
      workspaceId: "ws_backup",
      userId: "user_1",
      userMessage: "میخوام نوبت مشاوره رزرو کنم",
    });

    expect(res.provider).toBe("BACKUP_ENGINE");
    expect(res.model).toBe("HEURISTIC_V1");
    expect(res.isSafe).toBe(true);
    expect(res.replyText.length).toBeGreaterThan(10);
  });

  it("handles comments gracefully via backup engine when AI is down", async () => {
    const validComment = await processAiComment({
      workspaceId: "ws_backup",
      commentId: "cmt_1",
      commentText: "قیمتش چنده لطفا؟",
    });
    expect(validComment.isSpam).toBe(false);
    expect(validComment.shouldSkip).toBe(false);
    expect(validComment.replyText).toContain("دایرکت");

    const spamComment = buildBackupCommentReply("فالوور ارزان کلیک کن https://spam.test");
    expect(spamComment.isSpam).toBe(true);
    expect(spamComment.shouldSkip).toBe(true);
  });

  it("uses offlineMessage as backup in buildBackupSmartResponse when KB is empty", () => {
    const msg = buildBackupSmartResponse({
      userMessage: "سلام سوال داشتم",
      offlineMessage: "سلام! پیام شما ثبت شد، همکارانمون ساعت ۹ صبح پاسخ میدن.",
    });
    expect(msg).toBe("سلام! پیام شما ثبت شد، همکارانمون ساعت ۹ صبح پاسخ میدن.");
    expect(classifyBackupIntent("سلام").primaryIntent).toBe("GREETING");
  });
});
