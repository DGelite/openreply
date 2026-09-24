/**
 * Keyword Matcher — ManyChat-Level Persian/Arabic + Latin Support
 *
 * Handles:
 * - Case-insensitive matching (Latin)
 * - Full Persian/Arabic character normalization:
 *   · Arabic YEH (ي) → Persian YEH (ی)
 *   · Arabic KAF (ك) → Persian KAF (ک)
 *   · ALEF variants (آ، أ، إ) → plain ALEF (ا)
 *   · WAW with Hamza (ؤ) → WAW (و)
 *   · YEH with Hamza (ئ) → YEH (ی)
 *   · TEH MARBUTA (ة) → HEH (ه)
 *   · Full Arabic diacritics (harakat) stripped
 *   · Tatweel / kashida (ـ) stripped
 *   · ZWNJ (‌) → space (handles compound Persian words like می‌روم → می روم)
 * - RTL-safe word boundary detection (spaces, punctuation, start/end of text)
 *   because \b does NOT work for Arabic/Persian Unicode ranges
 * - Partial matching (substring) as fallback
 * - Multi-keyword OR logic (any match = true)
 * - Emoji stripping (keeps Unicode letters/numbers)
 * - Full-width character folding
 */

export interface KeywordMatchResult {
  matched: boolean;
  matchedKeyword: string | null;
}

// ── Persian/Arabic Unicode ranges ─────────────────────────────────────────
// Used to detect whether a keyword is in Arabic/Persian script so we can
// apply RTL-specific word-boundary logic instead of the broken \b approach.
const ARABIC_PERSIAN_RANGE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

/**
 * Normalize Persian and Arabic characters to a unified form.
 * Keeps the text meaningfully searchable while removing irrelevant variation.
 */
export function normalizePersian(text: string): string {
  return text
    // ── YEH variants → Persian YEH ──────────────────────────────────────
    .replace(/\u064A/g, "\u06CC") // Arabic YEH (ي) → Persian YEH (ی)
    .replace(/\u0649/g, "\u06CC") // ALEF MAQSURA (ى) → Persian YEH (ی)
    .replace(/\u0626/g, "\u06CC") // YEH WITH HAMZA (ئ) → YEH (ی)

    // ── KAF variants → Persian KAF ──────────────────────────────────────
    .replace(/\u0643/g, "\u06A9") // Arabic KAF (ك) → Persian KAF (ک)

    // ── ALEF variants → plain ALEF ──────────────────────────────────────
    .replace(/[\u0622\u0623\u0625]/g, "\u0627") // آ، أ، إ → ا
    .replace(/\u0671/g, "\u0627") // ALEF WASLA → ALEF

    // ── WAW variants ─────────────────────────────────────────────────────
    .replace(/\u0624/g, "\u0648") // WAW WITH HAMZA (ؤ) → WAW (و)

    // ── HEH variants ─────────────────────────────────────────────────────
    .replace(/\u0629/g, "\u0647") // TEH MARBUTA (ة) → HEH (ه)
    .replace(/\u06C0/g, "\u0647") // HEH WITH YEH ABOVE (ۀ) → HEH (ه)

    // ── HAMZAs ───────────────────────────────────────────────────────────
    .replace(/\u0621/g, "") // standalone HAMZA — often decorative, strip it

    // ── Diacritics (harakat) — Arabic short vowel marks ──────────────────
    .replace(/[\u064B-\u065F\u0670]/g, "") // fathah, kasrah, dammah, etc.

    // ── Tatweel/Kashida — stretching glyph used for emphasis ─────────────
    .replace(/\u0640/g, "") // Arabic TATWEEL (ـ)

    // ── Zero-Width Non-Joiner → space ────────────────────────────────────
    // Separates compound Persian words (می‌روم → می روم). Critical for
    // matching keywords like "می‌خوام" when user types "می خوام".
    .replace(/\u200C/g, " ")

    // ── Zero-Width Joiner → removed ──────────────────────────────────────
    .replace(/\u200D/g, "")

    // ── Right-to-Left marks ───────────────────────────────────────────────
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "");
}

/**
 * Fold full-width ASCII (Ａ-Ｚ, ａ-ｚ, ０-９) to their half-width equivalents.
 * Handles cases where users type keywords in full-width on mobile keyboards.
 */
function foldFullWidth(text: string): string {
  return text.replace(/[\uFF01-\uFF5E]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xFF00 + 0x20)
  );
}

/**
 * Strip emojis and special characters, keeping Unicode letters/numbers and whitespace.
 * Returns a clean, searchable string.
 */
export function stripSpecialCharacters(text: string): string {
  const normalized = normalizePersian(foldFullWidth(text));
  return normalized
    // Emoji blocks
    .replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}]/gu,
      ""
    )
    // Keep only Unicode letters, digits, whitespace
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build a RTL-safe "whole word" regex for a Persian/Arabic keyword.
 *
 * \b (word boundary) is only reliable for ASCII. For Persian/Arabic we use
 * lookahead/lookbehind for whitespace, string start/end, or non-letter chars.
 */
function buildRtlWordBoundaryRegex(keyword: string): RegExp {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Match keyword surrounded by:
  //   - start/end of string, OR
  //   - any character that is NOT a Unicode letter or digit
  return new RegExp(
    `(?:^|(?<=[^\\p{L}\\p{N}]))${escaped}(?=$|[^\\p{L}\\p{N}])`,
    "giu"
  );
}

/**
 * Check if a comment text matches any of the given keywords.
 *
 * Matching logic (in priority order):
 * 1. Exact substring match on normalized+cleaned text (fastest, covers most cases)
 * 2. RTL word-boundary match for Persian/Arabic keywords (avoids false positives)
 * 3. Latin \w-boundary regex for non-Arabic keywords (whole-word mode)
 */
export function matchKeywords(
  commentText: string,
  keywords: string[],
  wholeWordMatch: boolean = true
): KeywordMatchResult {
  if (!commentText || keywords.length === 0) {
    return { matched: false, matchedKeyword: null };
  }

  // Normalize both forms of the comment text once — reused for every keyword
  const rawNormalized = normalizePersian(commentText).toLowerCase();
  const cleaned = stripSpecialCharacters(commentText).toLowerCase();

  if (!rawNormalized && !cleaned) {
    return { matched: false, matchedKeyword: null };
  }

  for (const keyword of keywords) {
    if (!keyword || !keyword.trim()) continue;

    const rawNormalizedKw = normalizePersian(keyword).toLowerCase().trim();
    const cleanedKw = stripSpecialCharacters(keyword).toLowerCase().trim();

    if (!rawNormalizedKw && !cleanedKw) continue;

    // ── Strategy 1: Simple substring (partial match) ─────────────────────
    // Both the raw-normalized and cleaned forms are checked, so a keyword
    // like "کجا" will match "کجایی" (partial) or an exact occurrence.
    const partialMatch =
      (cleanedKw && cleaned.includes(cleanedKw)) ||
      (rawNormalizedKw && rawNormalized.includes(rawNormalizedKw));

    if (!wholeWordMatch) {
      // Partial mode: substring found anywhere → match
      if (partialMatch) return { matched: true, matchedKeyword: keyword };
      continue;
    }

    // ── Strategy 2: Whole-word match ─────────────────────────────────────
    if (!partialMatch) {
      // Keyword not even a substring — skip the more expensive regex checks
      continue;
    }

    // Determine if keyword contains Arabic/Persian script characters
    const isPersianArabic =
      ARABIC_PERSIAN_RANGE.test(rawNormalizedKw) ||
      ARABIC_PERSIAN_RANGE.test(cleanedKw);

    if (isPersianArabic) {
      // ── RTL word boundary check ────────────────────────────────────────
      // Try on the raw-normalized form (preserves Arabic/Persian glyphs)
      // and on the cleaned form (after emoji strip). Both are checked because
      // the user might have typed diacritics that get stripped.
      try {
        const rtlRegex = buildRtlWordBoundaryRegex(rawNormalizedKw);
        if (rtlRegex.test(rawNormalized)) {
          return { matched: true, matchedKeyword: keyword };
        }
        if (cleanedKw) {
          const rtlRegexCleaned = buildRtlWordBoundaryRegex(cleanedKw);
          if (rtlRegexCleaned.test(cleaned)) {
            return { matched: true, matchedKeyword: keyword };
          }
        }
      } catch {
        // Regex failed (e.g. lookbehind unsupported) — fall back to substring
        if (partialMatch) return { matched: true, matchedKeyword: keyword };
      }
    } else {
      // ── Latin word boundary check ──────────────────────────────────────
      const escapedKw = cleanedKw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      try {
        // \b works correctly for ASCII/Latin
        const latinRegex = new RegExp(`(?:^|\\s)${escapedKw}(?:$|\\s)`, "ui");
        if (latinRegex.test(cleaned)) {
          return { matched: true, matchedKeyword: keyword };
        }
      } catch {
        if (partialMatch) return { matched: true, matchedKeyword: keyword };
      }
    }
  }

  return { matched: false, matchedKeyword: null };
}
