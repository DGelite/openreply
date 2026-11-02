import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildBusinessPersonaPrompt } from "@/lib/ai/features/persona-engine";
import {
  evaluateConversationStrategy,
  isAskingForHuman,
  isCustomerUnhappy,
  hasStrongBuyingIntent,
} from "@/lib/ai/features/conversation-strategy";
import { GeminiProvider } from "@/lib/ai/providers/gemini-provider";
import { OpenAIProvider } from "@/lib/ai/providers/openai-provider";
import { BoxApiAiProvider } from "@/lib/ai/providers/boxapi-ai-provider";
import { getAiEngine, getEmbeddingEngine } from "@/lib/ai/factory";
import { queryKnowledgeBase } from "@/lib/ai/features/knowledge-base";
import { prisma } from "@/lib/db/client";

describe("Business AI Persona & Multi-Provider Architecture", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Persona System Prompt Construction", () => {
    it("generates conversational Persian prompt and strictly forbids military slop", () => {
      const prompt = buildBusinessPersonaPrompt({
        assistantName: "مهسا",
        roleTitle: "مشاور دوره‌ها",
        businessType: "آکادمی آموزش دیجیتال",
        targetAudience: "کارآموزان و مدیران کسب‌وکار",
        defaultTone: "صمیمی و حرفه‌ای",
      });

      expect(prompt).toContain("مهسا");
      expect(prompt).toContain("مشاور دوره‌ها");
      expect(prompt).toContain("آکادمی آموزش دیجیتال");

      // Must explicitly forbid military slop words and guru names
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
        hasPhone: true,
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

  describe("Requirement 1 & 2: Direct Official API Connections (OpenAI & Gemini)", () => {
    it("proves OpenAI connects directly to official api.openai.com without intermediaries", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "پاسخ مستقیم از OpenAI" }, finish_reason: "stop" }],
          usage: { prompt_tokens: 15, completion_tokens: 10 },
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const provider = new OpenAIProvider("test_openai_key_direct", "gpt-4o-mini");
      const result = await provider.generateCompletion({
        systemPrompt: "تو مشاور هستی",
        messages: [{ role: "user", content: "سلام" }],
      });

      expect(result.text).toBe("پاسخ مستقیم از OpenAI");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, init] = mockFetch.mock.calls[0];
      // PROVE DIRECT CONNECTION
      expect(url).toBe("https://api.openai.com/v1/chat/completions");
      expect(url).not.toContain("boxapi.ir");
      expect(init.headers["Authorization"]).toBe("Bearer test_openai_key_direct");
    });

    it("proves Gemini connects directly to official generativelanguage.googleapis.com without intermediaries", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: { parts: [{ text: "پاسخ مستقیم از Google Gemini" }] },
              finishReason: "STOP",
            },
          ],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 8 },
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const provider = new GeminiProvider("test_gemini_key_direct", "gemini-2.5-flash");
      const result = await provider.generateCompletion({
        systemPrompt: "تو مشاور هستی",
        messages: [{ role: "user", content: "سلام" }],
      });

      expect(result.text).toBe("پاسخ مستقیم از Google Gemini");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url] = mockFetch.mock.calls[0];
      // PROVE DIRECT CONNECTION
      expect(url).toContain("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent");
      expect(url).toContain("key=test_gemini_key_direct");
      expect(url).not.toContain("boxapi.ir");
    });
  });

  describe("Requirement 3, 4 & 5: BoxAPI AI State, Disabled-by-Default Guard & Strict Fallback", () => {
    it("proves BoxAPI AI is disabled by default and receives ZERO requests when turned off", async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal("fetch", mockFetch);

      vi.spyOn(prisma.aiConfig, "findUnique").mockResolvedValueOnce({
        id: "cfg_1",
        workspaceId: "ws_boxapi_off",
        isEnabled: true,
        provider: "BOXAPI",
        boxApiAiEnabled: false, // EXPLICITLY DISABLED
      } as any);

      // Attempting to invoke BoxAPI AI when disabled must throw error immediately
      await expect(getAiEngine("ws_boxapi_off")).rejects.toThrow(
        "سرویس BoxAPI AI غیرفعال است"
      );

      // Zero network requests sent to BoxAPI AI
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("proves BoxAPI AI works when explicitly enabled by user", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "پاسخ از سرویس BoxAPI AI" }, finish_reason: "stop" }],
          usage: { prompt_tokens: 12, completion_tokens: 8 },
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      vi.spyOn(prisma.aiConfig, "findUnique").mockResolvedValueOnce({
        id: "cfg_2",
        workspaceId: "ws_boxapi_on",
        isEnabled: true,
        provider: "BOXAPI",
        boxApiAiEnabled: true, // EXPLICITLY ENABLED
        boxApiAiKeyEncrypted: null,
        boxApiAiModel: "gpt-4o-mini",
        boxApiAiBaseUrl: "https://boxapi.ir/api/v1",
      } as any);

      const engine = await getAiEngine("ws_boxapi_on");
      const res = await engine.generateCompletion({
        messages: [{ role: "user", content: "سلام" }],
      });

      expect(res.text).toBe("پاسخ از سرویس BoxAPI AI");
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][0]).toBe("https://boxapi.ir/api/v1/chat/completions");
    });

    it("proves error in primary provider does NOT trigger unpermitted switch to BoxAPI AI", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("Google Gemini API Quota Exceeded 429"));
      vi.stubGlobal("fetch", mockFetch);

      vi.spyOn(prisma.aiConfig, "findUnique").mockResolvedValueOnce({
        id: "cfg_3",
        workspaceId: "ws_gemini_fail",
        isEnabled: true,
        provider: "GEMINI",
        allowAiFallback: false, // NO FALLBACK PERMITTED
        boxApiAiEnabled: true,
      } as any);

      const engine = await getAiEngine("ws_gemini_fail");

      // Must fail fast with primary error and NEVER dispatch to BoxAPI AI
      await expect(
        engine.generateCompletion({ messages: [{ role: "user", content: "سلام" }] })
      ).rejects.toThrow("Google Gemini API Quota Exceeded 429");

      // Verify all fetch calls were to Gemini, none to BoxAPI
      for (const call of mockFetch.mock.calls) {
        expect(call[0]).not.toContain("boxapi.ir");
      }
    });
  });

  describe("Requirement 5 & 6: Independent Embedding Settings & RAG Dimension Tolerance", () => {
    it("supports OpenAI embeddings with text-embedding-3-small (1536 dimensions)", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: new Array(1536).fill(0.123), index: 0 }],
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const provider = new OpenAIProvider("test_openai_key", "gpt-4o-mini");
      const embeddings = await provider.generateEmbeddings("سرفصل دوره طراحی وب");

      expect(embeddings.length).toBe(1);
      expect(embeddings[0].length).toBe(1536);
      expect(mockFetch.mock.calls[0][0]).toBe("https://api.openai.com/v1/embeddings");
    });

    it("tolerates dimension mismatch between query and stored chunks with hybrid keyword scoring", async () => {
      const mockDocs = [
        {
          id: "doc_1",
          workspaceId: "ws_rag_test",
          title: "گارانتی دوره‌ها",
          isApproved: true,
          chunks: [
            {
              id: "chunk_1",
              content: "دوره‌های آموزشی ما دارای ضمانت بازگشت ۱۰۰ درصدی وجه تا ۳۰ روز است.",
              // 768-dimensional stored vector (e.g. from previous Gemini model)
              embedding: new Array(768).fill(0.05),
            },
          ],
        },
      ];

      vi.spyOn(prisma.knowledgeDocument, "findMany").mockResolvedValue(mockDocs as any);

      // Query vector is 1536 dimensions (e.g. from OpenAI text-embedding-3-small)
      vi.spyOn(prisma.aiConfig, "findUnique").mockResolvedValue({
        workspaceId: "ws_rag_test",
        embeddingProvider: "OPENAI",
        embeddingModel: "text-embedding-3-small",
      } as any);

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: new Array(1536).fill(0.01), index: 0 }],
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      // Must execute gracefully without crashing on dimension mismatch
      const results = await queryKnowledgeBase("ws_rag_test", "ضمانت بازگشت وجه");
      expect(results.length).toBe(1);
      expect(results[0].content).toContain("ضمانت بازگشت ۱۰۰ درصدی");
      expect(results[0].score).toBeGreaterThan(0);
    });
  });
});
