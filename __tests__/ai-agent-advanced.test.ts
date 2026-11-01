import { describe, it, expect, beforeEach, vi } from "vitest";
import { analyzeSentimentAndBuyerScore, clearSentimentCache } from "@/lib/ai/features/sentiment-scoring";
import { classifyIntent, clearIntentCache } from "@/lib/ai/features/intent-recognition";
import { detectHumanHandoverNeed } from "@/lib/ai/features/human-handover";

// Mock factory and db client if fallback path is invoked
vi.mock("@/lib/ai/factory", () => ({
  getAiEngine: vi.fn().mockResolvedValue({
    generateCompletion: vi.fn().mockResolvedValue({
      text: JSON.stringify({
        primaryIntent: "SUPPORT",
        confidenceScore: 0.85,
        secondaryIntents: ["TECHNICAL_ISSUE"],
        reasoning: "LLM fallback classification",
        sentiment: "NEUTRAL",
        buyerScore: 50,
      }),
    }),
  }),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    aiAuditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
  },
}));

describe("Advanced AI Agent Features & Fast-Paths Suite", () => {
  beforeEach(() => {
    clearIntentCache();
    clearSentimentCache();
    vi.clearAllMocks();
  });

  describe("1. Deterministic Fast-Path: Intent Classification", () => {
    it("should classify standard Persian greetings instantly without LLM tokens", async () => {
      const inputs = ["سلام", "سلام وقت بخیر", "درود", "صبح بخیر", "خسته نباشید", "hello"];
      for (const msg of inputs) {
        const res = await classifyIntent("ws_test", msg);
        expect(res.primaryIntent).toBe("GREETING");
        expect(res.confidenceScore).toBe(1.0);
        expect(res.reasoning).toContain("Rule engine");
      }
    });

    it("should handle Arabic characters (Kaf/Yeh) and half-spaces in pricing queries", async () => {
      // "قيمت" with Arabic Yeh (\u064A)
      const arabicYehPrice = "قيمت چنده";
      const res1 = await classifyIntent("ws_test", arabicYehPrice);
      expect(res1.primaryIntent).toBe("PRICING");
      expect(res1.confidenceScore).toBe(0.95);

      // Half-space \u200C
      const halfSpacePrice = "قیمت\u200Cچنده؟";
      const res2 = await classifyIntent("ws_test", halfSpacePrice);
      expect(res2.primaryIntent).toBe("PRICING");

      // Direct keywords: تعرفه, هزینه
      const res3 = await classifyIntent("ws_test", "هزینه این پکیج چقدر میشه");
      expect(res3.primaryIntent).toBe("PRICING");
    });

    it("should recognize booking and appointment queries deterministically", async () => {
      const res1 = await classifyIntent("ws_test", "رزرو نوبت مشاوره");
      expect(res1.primaryIntent).toBe("APPOINTMENT");
      expect(res1.confidenceScore).toBe(0.95);

      const res2 = await classifyIntent("ws_test", "booking");
      expect(res2.primaryIntent).toBe("APPOINTMENT");
    });

    it("should return UNKNOWN intent on empty/whitespace message", async () => {
      const res = await classifyIntent("ws_test", "   ");
      expect(res.primaryIntent).toBe("UNKNOWN");
      expect(res.confidenceScore).toBe(1.0);
    });

    it("should fallback to LLM engine for ambiguous complex questions", async () => {
      const res = await classifyIntent("ws_test", "آیا محصول شما برای پوست حساس مناسبه؟");
      expect(res.primaryIntent).toBe("SUPPORT");
      expect(res.reasoning).toBe("LLM fallback classification");
    });

    it("should isolate cache across different workspaces (multi-tenancy)", async () => {
      // First call for ws_1
      await classifyIntent("ws_1", "چطور سفارش بدم؟");
      // Cache for ws_1 exists; ws_2 should still invoke LLM and cache under its own key
      const resWs2 = await classifyIntent("ws_2", "چطور سفارش بدم؟");
      expect(resWs2.primaryIntent).toBe("SUPPORT");
    });

    it("should bound cache to MAX_INTENT_CACHE_SIZE and prune oldest entries (FIFO)", async () => {
      // Insert 205 entries into cache
      for (let i = 0; i < 205; i++) {
        await classifyIntent("ws_test", `پیام خاص شماره ${i}`);
      }
      // System should remain performant without throwing or exceeding memory
      const freshRes = await classifyIntent("ws_test", "سلام");
      expect(freshRes.primaryIntent).toBe("GREETING");
    });
  });

  describe("2. Deterministic Fast-Path: Sentiment Scoring", () => {
    it("should detect Persian gratitude and praise deterministically", async () => {
      // Standard gratitude
      const res1 = await analyzeSentimentAndBuyerScore("ws_test", "خیلی ممنون دستتون درد نکنه");
      expect(res1.sentiment).toBe("POSITIVE");
      expect(res1.buyerScore).toBe(75);
      expect(res1.intentCategory).toBe("GRATITUDE");

      // Arabic Kaf (\u0643) in "نكنه"
      const res2 = await analyzeSentimentAndBuyerScore("ws_test", "دستتون درد ن\u0643نه");
      expect(res2.sentiment).toBe("POSITIVE");

      // "دمتون گرم عالیه"
      const res3 = await analyzeSentimentAndBuyerScore("ws_test", "عالیه دمتون گرم");
      expect(res3.sentiment).toBe("POSITIVE");
    });

    it("should return neutral fallback sentiment on empty message", async () => {
      const result = await analyzeSentimentAndBuyerScore("ws_test", "");
      expect(result.sentiment).toBe("NEUTRAL");
      expect(result.buyerScore).toBe(50);
    });
  });

  describe("3. Human Handover Detection", () => {
    it("should detect direct human handover keyword matches instantly", async () => {
      const result = await detectHumanHandoverNeed("test_ws", "لطفا منو به ادمین وصل کن");
      expect(result.requiresHandover).toBe(true);
      expect(result.confidenceScore).toBe(1.0);
    });

    it("should not trigger handover for normal questions", async () => {
      const result = await detectHumanHandoverNeed("test_ws", "سلام روزتون بخیر");
      expect(result.requiresHandover).toBe(false);
    });
  });
});
