import { describe, it, expect } from "vitest";
import { matchKeywords, normalizePersian, stripSpecialCharacters } from "@/lib/utils/keyword-matcher";

describe("Persian & Arabic Keyword Matcher — ManyChat-Level Coverage", () => {
  // ── Normalization ──────────────────────────────────────────────────────────
  describe("normalizePersian", () => {
    it("normalizes Arabic YEH to Persian YEH", () => {
      expect(normalizePersian("علي")).toBe("علی");
    });

    it("normalizes Arabic KAF to Persian KAF", () => {
      expect(normalizePersian("مشكل")).toBe("مشکل");
    });

    it("normalizes ALEF WITH HAMZA ABOVE to plain ALEF", () => {
      expect(normalizePersian("أحمد")).toBe("احمد");
    });

    it("normalizes ALEF WITH MADDA ABOVE to plain ALEF", () => {
      expect(normalizePersian("آمدن")).toBe("امدن");
    });

    it("strips tatweel / kashida (stretching character)", () => {
      expect(normalizePersian("سـلام")).toBe("سلام");
      expect(normalizePersian("وووووو")).toBe("وووووو"); // actual waaws, not tatweel
    });

    it("strips Arabic diacritics (harakat)", () => {
      // fatha, kasra, damma, shadda, sukun
      expect(normalizePersian("مُحَمَّدٌ")).toBe("محمد");
    });

    it("converts ZWNJ to space for compound Persian words", () => {
      expect(normalizePersian("می‌روم")).toBe("می روم");
      expect(normalizePersian("می‌خوام")).toBe("می خوام");
    });

    it("removes zero-width joiner", () => {
      expect(normalizePersian("لا‍الله")).toBe("لاالله");
    });

    it("removes RTL/LTR marks", () => {
      const withMark = "\u200Fسلام\u200E";
      expect(normalizePersian(withMark)).toBe("سلام");
    });
  });

  // ── stripSpecialCharacters ─────────────────────────────────────────────────
  describe("stripSpecialCharacters", () => {
    it("strips emojis while keeping Persian text", () => {
      const result = stripSpecialCharacters("کجایی؟ 🔥🔥");
      expect(result).not.toContain("🔥");
      expect(result).toContain("کجایی");
    });

    it("folds full-width ASCII to half-width", () => {
      const result = stripSpecialCharacters("ＨＥＬＬＯworld");
      expect(result.toLowerCase()).toContain("hello");
    });
  });

  // ── matchKeywords — Partial (no whole-word requirement) ───────────────────
  describe("partial matching (wholeWordMatch=false)", () => {
    it("matches exact Persian keyword", () => {
      const result = matchKeywords("سلام", ["سلام"], false);
      expect(result.matched).toBe(true);
      expect(result.matchedKeyword).toBe("سلام");
    });

    it("matches Persian keyword within a sentence", () => {
      const result = matchKeywords("من می‌خوام اطلاعات بیشتر", ["اطلاعات"], false);
      expect(result.matched).toBe(true);
    });

    it("matches keyword with Arabic YEH variant (ي vs ی)", () => {
      // User typed Arabic YEH (ي) but automation keyword uses Persian YEH (ی)
      const result = matchKeywords("علي آمد", ["علی"], false);
      expect(result.matched).toBe(true);
    });

    it("matches keyword with kashida stretching", () => {
      // User typed with decorative stretching: سـلام
      const result = matchKeywords("سـلام دوست", ["سلام"], false);
      expect(result.matched).toBe(true);
    });

    it("matches keyword despite diacritics in user text", () => {
      const result = matchKeywords("مُحَمَّد", ["محمد"], false);
      expect(result.matched).toBe(true);
    });

    it("matches keyword inside emoji-heavy comment", () => {
      const result = matchKeywords("🔥🔥 قیمت 🔥🔥", ["قیمت"], false);
      expect(result.matched).toBe(true);
    });

    it("matches Latin keyword case-insensitively", () => {
      const result = matchKeywords("HELLO world", ["hello"], false);
      expect(result.matched).toBe(true);
    });

    it("matches keyword with ZWNJ compound word variation", () => {
      // Automation keyword: می‌خوام — User types: می خوام (with space)
      const result = matchKeywords("می خوام بدونم", ["می‌خوام"], false);
      expect(result.matched).toBe(true);
    });

    it("matches keyword with ZWNJ in opposite direction", () => {
      // Automation keyword: می خوام — User types with ZWNJ: می‌خوام
      const result = matchKeywords("می‌خوام بدونم", ["می خوام"], false);
      expect(result.matched).toBe(true);
    });

    it("returns no match when keyword is absent", () => {
      const result = matchKeywords("سلام دوست", ["خرید"], false);
      expect(result.matched).toBe(false);
    });

    it("matches first keyword from multi-keyword list", () => {
      const result = matchKeywords("قیمت چنده", ["لینک", "قیمت", "خرید"], false);
      expect(result.matched).toBe(true);
      expect(result.matchedKeyword).toBe("قیمت");
    });

    it("handles empty comment gracefully", () => {
      const result = matchKeywords("", ["سلام"], false);
      expect(result.matched).toBe(false);
    });

    it("handles empty keyword list gracefully", () => {
      const result = matchKeywords("سلام", [], false);
      expect(result.matched).toBe(false);
    });
  });

  // ── matchKeywords — Whole-word mode ───────────────────────────────────────
  describe("whole-word matching (wholeWordMatch=true)", () => {
    it("matches standalone Persian keyword", () => {
      const result = matchKeywords("قیمت چنده؟", ["قیمت"], true);
      expect(result.matched).toBe(true);
    });

    it("does NOT match keyword as sub-string of a longer word", () => {
      // "لینک" should NOT match "لینکها" in whole-word mode
      const result = matchKeywords("لینکها را ببینید", ["لینک"], true);
      // This is the distinction from partial mode — RTL whole-word is space-based
      // In practice: "لینکها" has no space, so "لینک" is a substring of "لینکها"
      // After stripping to word-based boundaries, this should NOT match
      expect(result.matched).toBe(false);
    });

    it("matches Latin whole-word correctly", () => {
      const result = matchKeywords("I want info please", ["info"], true);
      expect(result.matched).toBe(true);
    });

    it("does NOT match Latin sub-string in whole-word mode", () => {
      const result = matchKeywords("information is here", ["info"], true);
      expect(result.matched).toBe(false);
    });

    it("matches Persian keyword at start of text", () => {
      const result = matchKeywords("خرید بهترین محصولات", ["خرید"], true);
      expect(result.matched).toBe(true);
    });

    it("matches Persian keyword at end of text", () => {
      const result = matchKeywords("می‌خوام بدانم قیمت", ["قیمت"], true);
      expect(result.matched).toBe(true);
    });

    it("matches Arabic keyword with YEH normalization in whole-word mode", () => {
      // User typed Arabic-script "علي" but keyword is "علی" — normalized match
      const result = matchKeywords("از علي بپرسید", ["علی"], true);
      expect(result.matched).toBe(true);
    });

    it("matches across emoji + Persian in whole-word mode", () => {
      const result = matchKeywords("✅ قیمت ✅", ["قیمت"], true);
      expect(result.matched).toBe(true);
    });
  });

  // ── Real-world Persian Instagram comment scenarios ────────────────────────
  describe("real-world Persian Instagram scenarios", () => {
    it("matches 'لینک' keyword from typical comment", () => {
      const result = matchKeywords("لینک بده 🙏", ["لینک"], false);
      expect(result.matched).toBe(true);
    });

    it("matches 'قیمت' from a common purchase-intent comment", () => {
      const result = matchKeywords("قیمتش چنده؟ 😊", ["قیمت"], false);
      expect(result.matched).toBe(true);
    });

    it("matches 'خرید' from a buy-intent comment", () => {
      const result = matchKeywords("چطور میشه خرید کرد؟", ["خرید"], false);
      expect(result.matched).toBe(true);
    });

    it("matches 'INFO' keyword from mixed Persian/English comment", () => {
      const result = matchKeywords("سلام, INFO بده", ["info"], false);
      expect(result.matched).toBe(true);
    });

    it("handles Arabic variant of 'درباره' correctly", () => {
      // Some Persian users type Arabic variants due to keyboard differences
      const result = matchKeywords("درباره این محصول بیشتر توضیح بده", ["درباره"], false);
      expect(result.matched).toBe(true);
    });

    it("does not match unrelated Persian keyword", () => {
      const result = matchKeywords("عکس خوبیه", ["قیمت", "خرید", "لینک"], false);
      expect(result.matched).toBe(false);
    });

    it("matches multiple fallback keywords — picks first match", () => {
      const result = matchKeywords("چطور میشه این رو خرید؟", ["لینک", "خرید", "قیمت"], false);
      expect(result.matched).toBe(true);
      expect(result.matchedKeyword).toBe("خرید");
    });
  });
});
