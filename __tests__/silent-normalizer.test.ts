import { describe, it, expect, vi, beforeEach } from "vitest";
import { normalizeLeadData } from "@/lib/ai/lead-normalizer";
import { GeminiProvider } from "@/lib/ai/providers/gemini-provider";

vi.mock("@/lib/db/client", () => ({
  prisma: {
    aiConfig: {
      findUnique: vi.fn(),
    },
    lead: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/ai/factory", () => ({
  getAiEngine: vi.fn(),
}));

describe("Modular AI Silent Normalizer & Fast-Path Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Fast-Path Zero-Token Guard (0ms, 0 Tokens)", () => {
    it("should fast-path a clean 2-word Persian name without calling AI", async () => {
      const res = await normalizeLeadData({
        workspaceId: "ws_123",
        userMessage: "آرمین طهماسبی",
        expectedField: "name",
      });

      expect(res.fastPath).toBe(true);
      expect(res.normalizedByAi).toBe(false);
      expect(res.firstName).toBe("آرمین");
      expect(res.lastName).toBe("طهماسبی");
      expect(res.fullName).toBe("آرمین طهماسبی");
      expect(res.replyMessageToUser).toBeNull();
    });

    it("should fast-path a clean 3-word Persian name with prefix/suffix", async () => {
      const res = await normalizeLeadData({
        workspaceId: "ws_123",
        userMessage: "سید محمد حسینی",
        expectedField: "name",
      });

      expect(res.fastPath).toBe(true);
      expect(res.firstName).toBe("سید");
      expect(res.lastName).toBe("محمد حسینی");
      expect(res.fullName).toBe("سید محمد حسینی");
    });

    it("should fast-path a clean Persian numeral phone number", async () => {
      const res = await normalizeLeadData({
        workspaceId: "ws_123",
        userMessage: "۰۹۱۲۳۴۵۶۷۸۹",
        expectedField: "phone",
      });

      expect(res.fastPath).toBe(true);
      expect(res.normalizedByAi).toBe(false);
      expect(res.phone).toBe("09123456789");
      expect(res.replyMessageToUser).toBeNull();
    });

    it("should fast-path an English 11-digit mobile number", async () => {
      const res = await normalizeLeadData({
        workspaceId: "ws_123",
        userMessage: "09351234567",
        expectedField: "phone",
      });

      expect(res.fastPath).toBe(true);
      expect(res.phone).toBe("09351234567");
    });
  });

  describe("2. Conversational Heuristic Fallback & Silent Normalization", () => {
    it("should clean conversational greetings from a full sentence name input", async () => {
      const res = await normalizeLeadData({
        workspaceId: "ws_123",
        userMessage: "سلام روزتون بخیر من آرمین طهماسبی هستم",
        expectedField: "name",
      });

      expect(res.firstName).toBe("آرمین");
      expect(res.lastName).toBe("طهماسبی");
      expect(res.fullName).toBe("آرمین طهماسبی");
      // CRITICAL INVARIANT: User receives NO AI error or chatter in silent mode
      expect(res.replyMessageToUser).toBeNull();
    });

    it("should extract phone and notes from a sentence with conditions", async () => {
      const res = await normalizeLeadData({
        workspaceId: "ws_123",
        userMessage: "شماره من 09123456789 هست فقط لطفا بعد از ظهرها تماس بگیرید",
        expectedField: "phone",
      });

      expect(res.phone).toBe("09123456789");
      expect(res.notes).toContain("بعد از ظهرها تماس بگیرید");
      expect(res.replyMessageToUser).toBeNull();
    });
  });

  describe("3. Zero-Error User Immunity (Graceful Fallback Protection)", () => {
    it("should never throw an error or return error text to user when AI engine fails", async () => {
      const { getAiEngine } = await import("@/lib/ai/factory");
      (getAiEngine as any).mockRejectedValue(new Error("Google Quota 429 Exceeded"));

      const res = await normalizeLeadData({
        workspaceId: "ws_123",
        userMessage: "سلام من سارا احمدی هستم میخواستم ثبت نام کنم",
        expectedField: "name",
      });

      // Does not throw!
      expect(res).toBeDefined();
      expect(res.firstName).toBe("سارا");
      expect(res.lastName).toBe("احمدی");
      expect(res.replyMessageToUser).toBeNull();
    });
  });

  describe("4. Multi-Key Gemini Failover Pool", () => {
    it("should parse multiple keys from newline or comma separated string", () => {
      const multiKeys = "key_alpha\nkey_beta,key_gamma";
      const provider = new GeminiProvider(multiKeys, "gemini-2.5-flash");
      expect(provider.getAvailableKeysCount()).toBe(3);
    });

    it("should rotate to next key in pool when an API error occurs", async () => {
      const multiKeys = ["key_fail_1", "key_success_2"];
      const provider = new GeminiProvider(multiKeys, "gemini-2.5-flash");

      let fetchCount = 0;
      global.fetch = vi.fn().mockImplementation((url: string) => {
        fetchCount++;
        if (url.includes("key=key_fail_1")) {
          return Promise.resolve({
            ok: false,
            status: 429,
            text: () => Promise.resolve("RESOURCE_EXHAUSTED"),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              candidates: [
                {
                  content: { parts: [{ text: "{\"firstName\":\"علی\",\"lastName\":\"رضایی\"}" }] },
                  finishReason: "STOP",
                },
              ],
            }),
        });
      });

      const completion = await provider.generateCompletion({
        messages: [{ role: "user", content: "علی رضایی" }],
      });

      expect(fetchCount).toBe(2);
      expect(completion.text).toContain("علی");
    });
  });

  describe("5. Workspace Settings Mode Control (Silent vs Co-Pilot)", () => {
    it("should respect ASSISTANT_CO_PILOT mode configured in AiConfig safetySettings", async () => {
      const { prisma } = await import("@/lib/db/client");
      const { getAiEngine } = await import("@/lib/ai/factory");

      (prisma.aiConfig.findUnique as any).mockResolvedValue({
        isEnabled: true,
        safetySettings: {
          leadNormalizer: {
            enabled: true,
            mode: "ASSISTANT_CO_PILOT",
            prompt: "custom prompt",
          },
        },
      });

      (getAiEngine as any).mockResolvedValue({
        generateCompletion: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            firstName: "مهدی",
            lastName: "کریمی",
            phone: null,
            notes: "پرسید هزینه چنده",
            questionAnswer: "هزینه دوره در لینک ثبت‌نام درج شده است.",
          }),
        }),
      });

      const res = await normalizeLeadData({
        workspaceId: "ws_123",
        userMessage: "سلام هزینه چنده من مهدی کریمی هستم",
        expectedField: "name",
      });

      expect(res.firstName).toBe("مهدی");
      expect(res.lastName).toBe("کریمی");
      expect(res.replyMessageToUser).toBe("هزینه دوره در لینک ثبت‌نام درج شده است.");
    });

    it("should return null replyMessageToUser in SILENT_NORMALIZE_ONLY mode even if AI sends questionAnswer", async () => {
      const { prisma } = await import("@/lib/db/client");
      const { getAiEngine } = await import("@/lib/ai/factory");

      (prisma.aiConfig.findUnique as any).mockResolvedValue({
        isEnabled: true,
        safetySettings: {
          leadNormalizer: {
            enabled: true,
            mode: "SILENT_NORMALIZE_ONLY",
          },
        },
      });

      (getAiEngine as any).mockResolvedValue({
        generateCompletion: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            firstName: "مهدی",
            lastName: "کریمی",
            phone: null,
            notes: "پرسید هزینه چنده",
            questionAnswer: "این نباید ارسال شود",
          }),
        }),
      });

      const res = await normalizeLeadData({
        workspaceId: "ws_123",
        userMessage: "سلام هزینه چنده من مهدی کریمی هستم",
        expectedField: "name",
      });

      expect(res.firstName).toBe("مهدی");
      expect(res.replyMessageToUser).toBeNull();
    });
  });
});
