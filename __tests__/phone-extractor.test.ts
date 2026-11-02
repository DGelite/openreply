import { describe, it, expect } from "vitest";
import {
  extractPhoneNumber,
  normalizeNumerals,
  isNonPhoneData,
  normalizeIranianPhone,
  detectIntentToProvidePhone,
  detectPhoneCorrection,
  detectPhoneOwnership,
} from "@/lib/ai/phone-extractor";

describe("Intelligent Phone Extraction Engine", () => {
  describe("Numeral Normalization", () => {
    it("converts Persian digits to ASCII English digits", () => {
      const persian = "۰۹۱۲۳۴۵۶۷۸۹";
      expect(normalizeNumerals(persian)).toBe("09123456789");
    });

    it("converts Arabic digits to ASCII English digits", () => {
      const arabic = "٠٩١٢٣٤٥٦٧٨٩";
      expect(normalizeNumerals(arabic)).toBe("09123456789");
    });

    it("handles mixed numeral strings correctly", () => {
      const mixed = "شماره من: ۰۹۱۲-345-۶۷۸۹ هست";
      expect(normalizeNumerals(mixed)).toBe("شماره من: 0912-345-6789 هست");
    });
  });

  describe("Negative Filters (Preventing False Positives)", () => {
    it("rejects 16-digit bank cards with Shetab prefix", () => {
      const card = "6037997123456789";
      const filter = isNonPhoneData("کارت به کارت کنید", card);
      expect(filter.isFalsePositive).toBe(true);
    });

    it("rejects postal tracking codes (24 digits)", () => {
      const postal = "123456789012345678901234";
      const filter = isNonPhoneData("کد رهگیری پست پیشتاز", postal);
      expect(filter.isFalsePositive).toBe(true);
    });

    it("rejects prices and monetary figures", () => {
      const res = extractPhoneNumber({
        messageText: "قیمت این دوره ۵۰۰ هزار تومان است",
      });
      expect(res.detected).toBe(false);
    });

    it("rejects order and invoice numbers", () => {
      const res = extractPhoneNumber({
        messageText: "کد سفارش من #123456 هست",
      });
      expect(res.detected).toBe(false);
    });

    it("rejects 10-digit national IDs", () => {
      const filter = isNonPhoneData("کد ملی من 0012345678", "0012345678");
      expect(filter.isFalsePositive).toBe(true);
    });
  });

  describe("Standard Mobile Extraction & Formatting", () => {
    it("extracts clean 11-digit Iranian mobile starting with 09", () => {
      const res = extractPhoneNumber({
        messageText: "09123456789",
      });
      expect(res.detected).toBe(true);
      expect(res.phoneNumber).toBe("09123456789");
      expect(res.confidence).toBeGreaterThanOrEqual(0.95);
      expect(res.owner).toBe("SELF");
    });

    it("extracts phone with Persian numerals embedded in a sentence", () => {
      const res = extractPhoneNumber({
        messageText: "سلام وقت بخیر، لطفا با شماره ۰۹۳۵۱۲۳۴۵۶۷ تماس بگیرید ممنون",
      });
      expect(res.detected).toBe(true);
      expect(res.phoneNumber).toBe("09351234567");
      expect(res.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it("normalizes international formats (+98 and 0098) to standard 09 format", () => {
      expect(normalizeIranianPhone("989123456789")).toBe("09123456789");
      expect(normalizeIranianPhone("00989123456789")).toBe("09123456789");
      expect(normalizeIranianPhone("9123456789")).toBe("09123456789");
    });

    it("extracts phone with dashes, spaces, and parenthesis", () => {
      const res = extractPhoneNumber({
        messageText: "(0912) 345 - 6789",
      });
      expect(res.detected).toBe(true);
      expect(res.phoneNumber).toBe("09123456789");
    });
  });

  describe("Multi-Message Buffer Assembly", () => {
    it("detects partial phone prefix (e.g., 0912) and sets isPartial", () => {
      const res = extractPhoneNumber({
        messageText: "0912",
      });
      expect(res.detected).toBe(false);
      expect(res.isPartial).toBe(true);
      expect(res.partialBuffer).toBe("0912");
    });

    it("stitches valid prefix with second message within 3 minute window", () => {
      const res = extractPhoneNumber({
        messageText: "3456789",
        previousBuffer: "0912",
        bufferAgeMs: 45000, // 45 seconds old
      });
      expect(res.detected).toBe(true);
      expect(res.phoneNumber).toBe("09123456789");
      expect(res.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it("ignores expired buffer older than 3 minutes", () => {
      const res = extractPhoneNumber({
        messageText: "3456789",
        previousBuffer: "0912",
        bufferAgeMs: 200000, // >3 minutes
      });
      expect(res.detected).toBe(false);
    });
  });

  describe("Conversational Intent & Correction", () => {
    it("identifies intent to provide phone in next message", () => {
      expect(detectIntentToProvidePhone("الان شماره می‌فرستم")).toBe(true);
      expect(detectIntentToProvidePhone("کجا شماره بفرستم")).toBe(true);

      const res = extractPhoneNumber({
        messageText: "سلام، الان شماره می‌فرستم خدمتتون",
      });
      expect(res.detected).toBe(false);
      expect(res.intent).toBe("INTENDING_TO_PROVIDE");
    });

    it("identifies phone number correction", () => {
      expect(detectPhoneCorrection("نه ببخشید اشتباه شد شماره درست اینه")).toBe(true);

      const res = extractPhoneNumber({
        messageText: "ببخشید اشتباه شد این درسته: 09129876543",
      });
      expect(res.detected).toBe(true);
      expect(res.isCorrection).toBe(true);
      expect(res.phoneNumber).toBe("09129876543");
    });

    it("identifies third-party phone ownership", () => {
      const selfCheck = detectPhoneOwnership("شماره من 09121111111 هست");
      expect(selfCheck.owner).toBe("SELF");

      const spouseCheck = detectPhoneOwnership("این شماره همسرم هست");
      expect(spouseCheck.owner).toBe("THIRD_PARTY");
      expect(spouseCheck.ownerName).toBe("همسرم");

      const colleagueCheck = extractPhoneNumber({
        messageText: "شماره همکارم خانم احمدی 09123334455",
      });
      expect(colleagueCheck.detected).toBe(true);
      expect(colleagueCheck.owner).toBe("THIRD_PARTY");
    });
  });
});
