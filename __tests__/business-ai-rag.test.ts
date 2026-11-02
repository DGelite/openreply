import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildBusinessPersonaPrompt } from "@/lib/ai/features/persona-engine";
import {
  evaluateConversationStrategy,
  isAskingForHuman,
  isCustomerUnhappy,
  hasStrongBuyingIntent,
} from "@/lib/ai/features/conversation-strategy";
import { BoxApiAiProvider } from "@/lib/ai/providers/boxapi-ai-provider";

describe("Business AI Persona & Conversation Funnel Engine", () => {
  describe("Persona System Prompt Construction", () => {
    it("generates conversational Persian prompt and strictly forbids military slop", () => {
      const prompt = buildBusinessPersonaPrompt({
        assistantName: "مهسا",
        roleTitle: "مشاور دوره‌ها",
        businessType: "آکادمی آموزش دیجیتال",
        targetAudience: "کارآموزان و مدیران کسب‌وکار",
        defaultTone: "صمیمی و حرفه‌ای",
      });

      // Must identify persona
      expect(prompt).toContain("مهسا");
      expect(prompt).toContain("مشاور دوره‌ها");
      expect(prompt).toContain("آکادمی آموزش دیجیتال");

      // Must explicitly forbid military slop words in system prompt
      expect(prompt).toContain("فرمانده");
      expect(prompt).toContain("امپراتوری");
      expect(prompt).toContain("اتاق جنگ");
      expect(prompt).toContain("الکس هرموزی");
      expect(prompt).toContain("راسل برانسون");
    });

    it("injects custom objection policies and escalation rules", () => {
      const prompt = buildBusinessPersonaPrompt({
        unhappyClientPolicy: "اول عذرخواهی کن و سریع وصل کن به پشتیبان انسانی.",
        priceObjectionPolicy: "ارزش ROI دوره را توضیح بده.",
        preferredWords: ["مشاوره اختصاصی", "پشتیبانی دائمی"],
      });

      expect(prompt).toContain("اول عذرخواهی کن و سریع وصل کن به پشتیبان انسانی.");
      expect(prompt).toContain("ارزش ROI دوره را توضیح بده.");
      expect(prompt).toContain("مشاوره اختصاصی، پشتیبانی دائمی");
    });
  });

  describe("Conversation Funnel Progression & Strategy", () => {
    it("detects explicit human escalation requests", () => {
      expect(isAskingForHuman("وصل کن به اپراتور")).toBe(true);
      expect(isAskingForHuman("میخوام با یک آدم صحبت کنم")).toBe(true);
      expect(isAskingForHuman("قیمت دوره چنده؟")).toBe(false);

      const decision = evaluateConversationStrategy({
        primaryGoal: "LEAD_GENERATION",
        userMessage: "لطفا وصل کنید به ادمین یا مسئول",
        hasPhone: false,
        hasEmail: false,
        conversationTurns: 2,
        lastAiAskedForPhone: false,
        isUnhappy: false,
        isRequestingHuman: true,
        hasBuyingIntent: false,
      });

      expect(decision.action).toBe("ESCALATE_TO_HUMAN");
    });

    it("detects customer frustration / complaints and handles delicately", () => {
      expect(isCustomerUnhappy("چرا جواب نمیدید؟ واقعا افتضاحه")).toBe(true);
      expect(isCustomerUnhappy("سلام خسته نباشید")).toBe(false);

      const decision = evaluateConversationStrategy({
        primaryGoal: "LEAD_GENERATION",
        userMessage: "چرا پیگیری نمیکنید؟ پولم رو پس بدید",
        hasPhone: false,
        hasEmail: false,
        conversationTurns: 3,
        lastAiAskedForPhone: false,
        isUnhappy: true,
        isRequestingHuman: false,
        hasBuyingIntent: false,
      });

      expect(decision.action).toBe("HANDLE_UNHAPPY");
    });

    it("guides toward phone capture when buying intent detected and phone is missing", () => {
      expect(hasStrongBuyingIntent("میخوام ثبت نام کنم شرایط چطوره؟")).toBe(true);

      const decision = evaluateConversationStrategy({
        primaryGoal: "LEAD_GENERATION",
        userMessage: "من حتما این دوره رو میخوام بخرم، چطور اقدام کنم؟",
        hasPhone: false,
        hasEmail: false,
        conversationTurns: 1,
        lastAiAskedForPhone: false,
        isUnhappy: false,
        isRequestingHuman: false,
        hasBuyingIntent: true,
      });

      expect(decision.action).toBe("PROCEED_TO_PHONE");
      expect(decision.guidelineForAi).toContain("شماره");
    });

    it("enforces anti-nagging: does not ask for phone again if already captured", () => {
      const decision = evaluateConversationStrategy({
        primaryGoal: "LEAD_GENERATION",
        userMessage: "سرفصل‌های بخش سوم چیا هستن؟",
        hasPhone: true, // Phone already captured!
        hasEmail: true,
        conversationTurns: 4,
        lastAiAskedForPhone: false,
        isUnhappy: false,
        isRequestingHuman: false,
        hasBuyingIntent: false,
      });

      expect(decision.action).toBe("ANSWER_ONLY");
      expect(decision.guidelineForAi).toContain("اصرار به دریافت شماره خودداری کن");
    });
  });

  describe("BoxAPI AI Provider Integration", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("formats chat completion payload correctly for BoxAPI", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "سلام! دوره جامع سئو شامل ۲۰ ساعت آموزش و پروژه عملی است.",
              },
            },
          ],
        }),
      });

      vi.stubGlobal("fetch", mockFetch);

      const provider = new BoxApiAiProvider({
        apiKey: "test_box_ai_key_123",
        model: "boxapi-gpt-4o",
      });

      const result = await provider.generateCompletion({
        systemPrompt: "تو مشاور فروش هستی.",
        messages: [{ role: "user", content: "دوره سئو چطوریه؟" }],
        maxTokens: 150,
      });

      expect(result.text).toBe("سلام! دوره جامع سئو شامل ۲۰ ساعت آموزش و پروژه عملی است.");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toBe("https://boxapi.ir/api/v1/chat/completions");
      expect(callArgs[1].headers["Authorization"]).toBe("Bearer test_box_ai_key_123");

      const body = JSON.parse(callArgs[1].body);
      expect(body.messages[0].role).toBe("system");
      expect(body.messages[0].content).toBe("تو مشاور فروش هستی.");
      expect(body.messages[1].role).toBe("user");
      expect(body.messages[1].content).toBe("دوره سئو چطوریه؟");
    });
  });
});
