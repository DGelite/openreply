import { describe, test, expect, vi } from "vitest";

vi.mock("@/lib/db/client", () => ({
  prisma: {
    systemFeatureFlag: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    aiAgentConfig: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

import { DEFAULT_FEATURE_CONFIGS } from "../lib/flags/feature-flags";
import { generateEventHash } from "../lib/automation/dedup";
import { calculateSmartDelayMs } from "../lib/meta/smart-delay";
import { compressConversationMemory } from "../lib/ai/context-compression";
import { hashPassword, verifyPassword } from "../lib/auth/password";

describe("Enterprise Core Feature Tests", () => {
  test("Feature flags defaults should contain all 9 features", () => {
    expect(DEFAULT_FEATURE_CONFIGS.SPIKE_BUFFER.isEnabled).toBe(true);
    expect(DEFAULT_FEATURE_CONFIGS.HUMAN_HANDOVER.isEnabled).toBe(true);
    expect(DEFAULT_FEATURE_CONFIGS.SMART_DELAY.isEnabled).toBe(true);
    expect(DEFAULT_FEATURE_CONFIGS.AI_COMPRESSION.isEnabled).toBe(true);
    expect(DEFAULT_FEATURE_CONFIGS.DEDUP.isEnabled).toBe(true);
    expect(DEFAULT_FEATURE_CONFIGS.DLQ.isEnabled).toBe(true);
    expect(DEFAULT_FEATURE_CONFIGS.SMS_FALLBACK.isEnabled).toBe(true);
    expect(DEFAULT_FEATURE_CONFIGS.FUNNEL.isEnabled).toBe(true);
    expect(DEFAULT_FEATURE_CONFIGS.GLASS_UI.isEnabled).toBe(true);
  });

  test("Deduplication SHA-256 hash generator works", () => {
    const hash1 = generateEventHash({ user: "user1", msg: "hello" });
    const hash2 = generateEventHash({ user: "user1", msg: "hello" });
    const hash3 = generateEventHash({ user: "user2", msg: "hello" });

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
  });

  test("Smart Delay calculates within bounds", async () => {
    const delay = await calculateSmartDelayMs("test-workspace");
    expect(delay).toBeGreaterThanOrEqual(3000);
    expect(delay).toBeLessThanOrEqual(10000);
  });

  test("Context compression truncates long history", async () => {
    const messages = Array.from({ length: 20 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `Message ${i}`,
    }));

    const compressed = await compressConversationMemory(messages, "test-workspace");
    expect(compressed.length).toBeLessThanOrEqual(7);
  });

  test("Password hashing and verification work", async () => {
    const hash = await hashPassword("Secret123!");
    const isValid = await verifyPassword("Secret123!", hash);
    const isInvalid = await verifyPassword("WrongPassword", hash);

    expect(isValid).toBe(true);
    expect(isInvalid).toBe(false);
  });
});
