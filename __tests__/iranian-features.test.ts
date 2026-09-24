import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db/client", () => ({
  prisma: {
    lead: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    dmBroadcast: {
      create: vi.fn().mockResolvedValue({ id: "bc_1" }),
      update: vi.fn().mockResolvedValue({ id: "bc_1" }),
    },
  },
}));

import { buildInstagramRefLink, parseInstagramRefPayload } from "@/lib/growth/ref-links";
import { requestZarrinPalPayment, verifyZarrinPalPayment } from "@/lib/payment/zarrinpal";
import { dispatchDmBroadcast } from "@/lib/growth/broadcasting";

describe("Iranian Enterprise Features Tests", () => {
  it("should generate correct Instagram ref link URL", () => {
    const url = buildInstagramRefLink({
      username: "@my_shop_ir",
      refPayload: "summer_sale",
    });
    expect(url).toBe("https://ig.me/m/my_shop_ir?ref=summer_sale");
  });

  it("should parse raw Instagram ref payload", () => {
    const parsed = parseInstagramRefPayload("discount_50");
    expect(parsed.isRefLink).toBe(true);
    expect(parsed.refCode).toBe("discount_50");
  });

  it("should format ZarrinPal payment request gracefully", async () => {
    const mockFetch = vi.spyOn(globalThis, "fetch").mockImplementationOnce(async () => {
      return {
        json: async () => ({
          data: { code: 100, authority: "A00000000000000000000000000000000000" },
        }),
      } as any;
    });

    const result = await requestZarrinPalPayment({
      amountTomans: 25000,
      description: "تست خرید دوره",
      callbackUrl: "https://example.com/callback",
      isSandbox: true,
    });
    expect(typeof result.success).toBe("boolean");
    expect(result.success).toBe(true);
    mockFetch.mockRestore();
  });

  it("should handle broadcast dispatch gracefully", async () => {
    const broadcast = await dispatchDmBroadcast({
      workspaceId: "test_ws_id",
      name: "تخفیف ویژه نوروز",
      messageText: "سلام! تخفیف ویژه شروع شد.",
    });
    expect(broadcast.success).toBe(true);
  });
});
