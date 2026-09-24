import { describe, it, expect } from "vitest";
import { analyzeSentimentAndBuyerScore } from "@/lib/ai/features/sentiment-scoring";
import { detectHumanHandoverNeed } from "@/lib/ai/features/human-handover";

describe("Advanced AI Agent Features Tests", () => {
  it("should detect direct human handover keyword matches instantly", async () => {
    const result = await detectHumanHandoverNeed("test_ws", "لطفا منو به ادمین وصل کن");
    expect(result.requiresHandover).toBe(true);
    expect(result.confidenceScore).toBe(1.0);
  });

  it("should return neutral fallback sentiment on empty message", async () => {
    const result = await analyzeSentimentAndBuyerScore("test_ws", "");
    expect(result.sentiment).toBe("NEUTRAL");
    expect(result.buyerScore).toBe(50);
  });
});
