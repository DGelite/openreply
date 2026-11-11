/**
 * OpenReply Intelligent Phone Extraction & Normalization Engine
 * Enterprise-grade parser for conversational Iranian & International phone numbers in Instagram DMs.
 * Features:
 * - Multi-language digit normalization (Persian, Arabic, English, Spoken Verbal Numbers)
 * - Negative filtering for order IDs, tracking codes, bank cards, prices, and national IDs
 * - Multi-message stitching and conversational intent detection
 * - Third-party vs Self ownership detection
 * - Number correction recognition ("نه قبلی اشتباه بود...")
 * - Confidence scoring & confirmation prompt generation
 */

export interface PhoneExtractionResult {
  detected: boolean;
  phoneNumber?: string; // Standard normalized format (e.g., 09123456789 or +14155552671)
  rawInput?: string;
  confidence: number; // 0.0 to 1.0
  owner: "SELF" | "THIRD_PARTY";
  ownerName?: string;
  isCorrection: boolean;
  isPartial: boolean;
  partialBuffer?: string;
  needsConfirmation: boolean;
  confirmationPrompt?: string;
  intent: "PROVIDING_PHONE" | "UPDATING_PHONE" | "INTENDING_TO_PROVIDE" | "NON_PHONE";
  rejectionReason?: string;
}

/**
 * Converts verbal Persian number words (e.g. "صفر نهصد و دوازده سیصد و چهل و پنج...")
 * to ASCII numeric digits.
 */
export function convertPersianWordsToDigits(input: string): string {
  if (!input) return "";

  // Normalize half-spaces, ZWNJ, and non-breaking spaces
  let text = input
    .replace(/[\u200c\u200b\u00a0]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Common complete 3-digit mobile prefixes in spoken Persian
  const prefixMap: Record<string, string> = {
    "صفر نهصد و دوازده": "0912 ",
    "صفر نهصد و نوزده": "0919 ",
    "صفر نهصد و ده": "0910 ",
    "صفر نهصد و یازده": "0911 ",
    "صفر نهصد و سیزده": "0913 ",
    "صفر نهصد و چهارده": "0914 ",
    "صفر نهصد و پانزده": "0915 ",
    "صفر نهصد و پونزده": "0915 ",
    "صفر نهصد و شانزده": "0916 ",
    "صفر نهصد و شونزده": "0916 ",
    "صفر نهصد و هفده": "0917 ",
    "صفر نهصد و هیفده": "0917 ",
    "صفر نهصد و هجده": "0918 ",
    "صفر نهصد و هیجده": "0918 ",
    "صفر نهصد و سی و پنج": "0935 ",
    "صفر نهصد و سی و شش": "0936 ",
    "صفر نهصد و سی و هفت": "0937 ",
    "صفر نهصد و سی و هشت": "0938 ",
    "صفر نهصد و سی و نه": "0939 ",
    "صفر نهصد و سی": "0930 ",
    "صفر نهصد و بیست و یک": "0921 ",
    "صفر نهصد و بیست و دو": "0922 ",
    "صفر نهصد و بیست": "0920 ",
    "صفر نهصد و دو": "0902 ",
    "صفر نهصد و سه": "0903 ",
    "صفر نهصد و یک": "0901 ",
    "صفر نهصد و پنج": "0905 ",

    "نهصد و دوازده": "912 ",
    "نهصد و نوزده": "919 ",
    "نهصد و ده": "910 ",
    "نهصد و یازده": "911 ",
    "نهصد و سیزده": "913 ",
    "نهصد و چهارده": "914 ",
    "نهصد و پانزده": "915 ",
    "نهصد و پونزده": "915 ",
    "نهصد و شانزده": "916 ",
    "نهصد و شونزده": "916 ",
    "نهصد و هفده": "917 ",
    "نهصد و هیفده": "917 ",
    "نهصد و هجده": "918 ",
    "نهصد و هیجده": "918 ",
    "نهصد و سی و پنج": "935 ",
    "نهصد و سی و شش": "936 ",
    "نهصد و سی و هفت": "937 ",
    "نهصد و سی و هشت": "938 ",
    "نهصد و سی و نه": "939 ",
    "نهصد و سی": "930 ",
    "نهصد و بیست و یک": "921 ",
    "نهصد و بیست و دو": "922 ",
    "نهصد و بیست": "920 ",
    "نهصد و دو": "902 ",
    "نهصد و سه": "903 ",
    "نهصد و یک": "901 ",
    "نهصد و پنج": "905 ",
  };

  for (const [phrase, replacement] of Object.entries(prefixMap)) {
    text = text.replaceAll(phrase, replacement);
  }

  // Tokenize remaining numbers: hundreds, tens, units
  const numberWordMap: Record<string, number> = {
    صفر: 0,
    یک: 1,
    یکی: 1,
    دو: 2,
    سه: 3,
    چهار: 4,
    پنج: 5,
    شش: 6,
    شیش: 6,
    هفت: 7,
    هشت: 8,
    نه: 9,
    ده: 10,
    یازده: 11,
    دوازده: 12,
    سیزده: 13,
    چهارده: 14,
    پانزده: 15,
    پونزده: 15,
    شانزده: 16,
    شونزده: 16,
    هفده: 17,
    هیفده: 17,
    هجده: 18,
    هیجده: 18,
    نوزده: 19,
    بیست: 20,
    سی: 30,
    چهل: 40,
    پنجاه: 50,
    شصت: 60,
    هفتاد: 70,
    هشتاد: 80,
    نود: 90,
    صد: 100,
    یکصد: 100,
    دویست: 200,
    سیصد: 300,
    چهارصد: 400,
    پانصد: 500,
    پونصد: 500,
    ششصد: 600,
    هفتصد: 700,
    هشتصد: 800,
    نهصد: 900,
  };

  const tokens = text.split(" ");
  const outTokens: string[] = [];
  let currentCompoundValue = 0;
  let inCompound = false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i].trim();
    if (!token) continue;

    if (token === "و" && inCompound) {
      continue;
    }

    if (numberWordMap[token] !== undefined) {
      const val = numberWordMap[token];
      if (inCompound) {
        if (val < 100 && currentCompoundValue >= 100 && currentCompoundValue % 100 === 0) {
          currentCompoundValue += val;
        } else if (val < 10 && currentCompoundValue >= 10 && currentCompoundValue % 10 === 0) {
          currentCompoundValue += val;
        } else {
          outTokens.push(String(currentCompoundValue));
          currentCompoundValue = val;
        }
      } else {
        currentCompoundValue = val;
        inCompound = true;
      }
    } else {
      if (inCompound) {
        outTokens.push(String(currentCompoundValue));
        inCompound = false;
        currentCompoundValue = 0;
      }
      outTokens.push(token);
    }
  }

  if (inCompound) {
    outTokens.push(String(currentCompoundValue));
  }

  return outTokens.join(" ");
}

/**
 * Normalizes Persian and Arabic numerals as well as verbal Persian number words to ASCII English digits.
 */
export function normalizeNumerals(input: string): string {
  if (!input) return "";

  // 1. Convert verbal Persian numbers
  let normalized = convertPersianWordsToDigits(input);

  // 2. Normalize ZWNJ and non-breaking spaces
  normalized = normalized.replace(/[\u200c\u200b\u00a0]/g, " ");

  // 3. Convert Persian and Arabic digits to ASCII English digits
  const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  const arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

  for (let i = 0; i < 10; i++) {
    normalized = normalized.replaceAll(persianDigits[i], String(i));
    normalized = normalized.replaceAll(arabicDigits[i], String(i));
  }

  return normalized;
}

/**
 * Negative Filters: checks whether numeric text represents non-phone data
 * (Prices, Bank Cards, Postal Codes, Order IDs, National IDs).
 */
export function isNonPhoneData(rawText: string, digitsOnly: string): { isFalsePositive: boolean; reason?: string } {
  const lower = rawText.toLowerCase();

  // 1. Bank card number check (16 digits or 4 groups of 4 digits)
  if (digitsOnly.length === 16 && (lower.includes("کارت") || lower.includes("شماره کارت") || lower.includes("card") || lower.includes("بانک"))) {
    return { isFalsePositive: true, reason: "Bank Card Number" };
  }
  if (digitsOnly.length === 16 && /^(5022|6037|6104|6274|6219|5892|6273|5057|6393|6280)/.test(digitsOnly)) {
    return { isFalsePositive: true, reason: "Iranian Bank Card Prefix" };
  }

  // 2. Postal Tracking Code (24 digits or 16+ digits with tracking keywords)
  if (digitsOnly.length === 24 || (lower.includes("کد رهگیری") && digitsOnly.length > 12)) {
    return { isFalsePositive: true, reason: "Postal Tracking Code" };
  }

  // If the message contains an actual valid Iranian mobile number, don't discard it as a price or invoice!
  const hasValidPhoneInMessage =
    /(?:(?:\+|00)?98\s*0?|0)?9\d{9}\b/.test(digitsOnly) ||
    /(?:(?:\+|00)?98\s*0?|0)?9[\s\-_().]*\d{3}[\s\-_().]*\d{3}[\s\-_().]*\d{4}/.test(rawText);

  if (!hasValidPhoneInMessage) {
    // 3. Price / Monetary Amount indicator
    const moneyKeywords = ["تومان", "تومن", "ریال", "هزار", "میلیون", "میلیارد", "تخفیف", "قیمت", "هزینه", "مبلغ", "واریز", "فیش"];
    if (moneyKeywords.some((kw) => lower.includes(kw)) && !lower.includes("شماره") && !lower.includes("تماس") && !lower.includes("موبایل") && !lower.includes("خط")) {
      return { isFalsePositive: true, reason: "Price or Monetary Amount" };
    }

    // 4. Order / Invoice numbers (e.g. #12345, کد سفارش: 998877)
    if ((lower.includes("سفارش") || lower.includes("فاکتور") || lower.includes("order") || lower.startsWith("#")) && digitsOnly.length !== 11) {
      return { isFalsePositive: true, reason: "Order or Invoice Number" };
    }

    // 5. Iranian National ID (10 digits not starting with 09)
    if (digitsOnly.length === 10 && !digitsOnly.startsWith("9") && (lower.includes("کد ملی") || lower.includes("کدملی"))) {
      return { isFalsePositive: true, reason: "National ID Code" };
    }
  }

  return { isFalsePositive: false };
}

/**
 * Normalizes an Iranian mobile phone number to standard 09xxxxxxxxx 11-digit string.
 */
export function normalizeIranianPhone(digits: string): string | null {
  // 1) Starts with 009809 or 9809 (e.g. +98 (0)912...)
  if (digits.startsWith("009809") && digits.length === 15) {
    return "0" + digits.substring(5);
  }
  if (digits.startsWith("9809") && digits.length === 13) {
    return "0" + digits.substring(3);
  }
  // 2) Starts with 00989 or 989 (e.g. +98912... or 0098912...)
  if (digits.startsWith("00989") && digits.length === 14) {
    return "0" + digits.substring(4);
  }
  if (digits.startsWith("989") && digits.length === 12) {
    return "0" + digits.substring(2);
  }
  // 3) Starts with 9 and has 10 digits (e.g. 9123456789)
  if (digits.startsWith("9") && digits.length === 10) {
    return "0" + digits;
  }
  // 4) Standard 09xxxxxxxxx with 11 digits
  if (digits.startsWith("09") && digits.length === 11) {
    return digits;
  }

  return null;
}

/**
 * Detects if the message is explicitly expressing future intent to send a phone number.
 */
export function detectIntentToProvidePhone(text: string): boolean {
  const compact = text.toLowerCase().replace(/[\u200c\u200b\u00a0\s]/g, "");
  const intentPhrases = [
    "الانشمارهمیفرستم",
    "شمارهمیفرستم",
    "شمارهبدم",
    "شمارهبفرستم",
    "شمارهمیدم",
    "میخوامشمارهبدم",
    "میخوامشمارهبفرستم",
    "تماسبگیریدشمارهبدم",
    "کجاشمارهبفرستم",
  ];

  return intentPhrases.some((phrase) => compact.includes(phrase));
}

/**
 * Detects if message is a phone number correction.
 */
export function detectPhoneCorrection(text: string): boolean {
  const compact = text.toLowerCase().replace(/[\u200c\u200b\u00a0\s]/g, "");
  const correctionKeywords = [
    "اشتباهشد",
    "ببخشیداشتباه",
    "شمارهقبلیاشتباه",
    "شمارهدرستاین",
    "شمارهاصلیاینه",
    "اصلاحمیکنم",
    "ایندرسته",
    "دستخورد",
    "دستمخورد",
    "غلطنوشتم",
  ];

  return correctionKeywords.some((phrase) => compact.includes(phrase));
}

/**
 * Detects whether the phone number belongs to a third party.
 */
export function detectPhoneOwnership(text: string): { owner: "SELF" | "THIRD_PARTY"; ownerName?: string } {
  const lower = text.toLowerCase();

  const thirdPartyRegex = /(شماره\s+)?(دوستم|همسرم|برادرم|خواهرم|همکارم|پدرم|مادرم|مدیرم|مدیرعاملمون|آقای|خانم)\s*([^\s:،,]+)?/i;
  const match = lower.match(thirdPartyRegex);

  if (match) {
    const relationship = match[2];
    const candidate = match[3]?.trim();
    const stopWords = ["هست", "است", "بود", "رو", "را", "میدم", "می‌دم", "بدم", "بفرستم", "شماره", "موبایل", "تلفن"];
    
    let name = relationship;
    if (candidate && !stopWords.includes(candidate) && !/^\d+$/.test(candidate)) {
      name = (relationship === "آقای" || relationship === "خانم") ? `${relationship} ${candidate}` : candidate;
    }
    return { owner: "THIRD_PARTY", ownerName: name };
  }

  return { owner: "SELF" };
}

/**
 * Main Enterprise Phone Extraction Routine
 */
export function extractPhoneNumber(params: {
  messageText: string;
  previousBuffer?: string | null;
  bufferAgeMs?: number;
}): PhoneExtractionResult {
  const { messageText, previousBuffer, bufferAgeMs = 0 } = params;

  if (!messageText || messageText.trim() === "") {
    return { detected: false, confidence: 0, owner: "SELF", isCorrection: false, isPartial: false, needsConfirmation: false, intent: "NON_PHONE" };
  }

  const rawClean = messageText.trim();
  const normalizedText = normalizeNumerals(rawClean);

  // 1. Check intent to provide phone later
  if (detectIntentToProvidePhone(normalizedText)) {
    return {
      detected: false,
      confidence: 0.7,
      owner: "SELF",
      isCorrection: false,
      isPartial: false,
      needsConfirmation: false,
      intent: "INTENDING_TO_PROVIDE",
    };
  }

  // 2. Detect correction intent
  const isCorrection = detectPhoneCorrection(normalizedText);

  // 3. Detect ownership (Self vs Third Party)
  const ownership = detectPhoneOwnership(normalizedText);

  // 4. Multi-message assembly check
  let candidateText = normalizedText;
  let assembledFromBuffer = false;

  if (previousBuffer && bufferAgeMs < 3 * 60 * 1000) {
    const rawDigitsOnly = normalizedText.replace(/[^0-9]/g, "");
    if (rawDigitsOnly.length >= 4 && rawDigitsOnly.length <= 8) {
      candidateText = previousBuffer + rawDigitsOnly;
      assembledFromBuffer = true;
    }
  }

  // 5. Negative filter check on full text
  const digitsOnly = candidateText.replace(/[^0-9]/g, "");
  const falsePositiveCheck = isNonPhoneData(rawClean, digitsOnly);
  if (falsePositiveCheck.isFalsePositive) {
    return {
      detected: false,
      confidence: 0,
      owner: "SELF",
      isCorrection: false,
      isPartial: false,
      needsConfirmation: false,
      intent: "NON_PHONE",
      rejectionReason: falsePositiveCheck.reason,
    };
  }

  // 6. Direct Regex Scan for Iranian Mobile Numbers
  // Matches all styles: 0912 345 6789, 0912-345-6789, 0912.345.6789, 0912/345/6789, (0912) 3456789, +989123456789, 9123456789, etc.
  const phoneScanRegex = /(?:(?:\+|00)?98[\s\-_().\/]*0?|0)?9[\s\-_().\/0-9]{8,22}[0-9]/g;
  const matches = candidateText.match(phoneScanRegex);

  if (matches && matches.length > 0) {
    for (const match of matches) {
      const matchDigits = match.replace(/[^0-9]/g, "");
      const normalizedIranian = normalizeIranianPhone(matchDigits);

      if (normalizedIranian) {
        let confidence = 0.95;

        // Higher confidence if explicit phone context or standalone
        const isStandalone = candidateText.trim().replace(/[^0-9]/g, "") === matchDigits;
        if (isStandalone) {
          confidence = 1.0;
        } else if (rawClean.includes("شماره") || rawClean.includes("تماس") || rawClean.includes("زنگ") || rawClean.includes("موبایل") || rawClean.includes("خط")) {
          confidence = 0.98;
        } else if (assembledFromBuffer) {
          confidence = 0.90;
        }

        if (isCorrection) {
          confidence = Math.max(confidence, 0.96);
        }

        return {
          detected: true,
          phoneNumber: normalizedIranian,
          rawInput: match,
          confidence,
          owner: ownership.owner,
          ownerName: ownership.ownerName,
          isCorrection,
          isPartial: false,
          needsConfirmation: confidence < 0.85,
          confirmationPrompt:
            confidence < 0.85
              ? `شماره شما ${normalizedIranian} ثبت شود؟ لطفاً تأیید کنید.`
              : undefined,
          intent: isCorrection ? "UPDATING_PHONE" : "PROVIDING_PHONE",
        };
      }
    }
  }

  // 7. Check for partial phone input (e.g. user sends only "0912" or "۰۹۱۲۳")
  if (digitsOnly.startsWith("09") && digitsOnly.length >= 3 && digitsOnly.length <= 7) {
    return {
      detected: false,
      confidence: 0.5,
      owner: "SELF",
      isCorrection: false,
      isPartial: true,
      partialBuffer: digitsOnly,
      needsConfirmation: false,
      intent: "PROVIDING_PHONE",
    };
  }

  // 8. International E.164 phone numbers (e.g. +14155552671, +971501234567)
  const internationalRegex = /\+([1-9][0-9\s\-()]{8,15}[0-9])\b/g;
  const intlMatch = candidateText.match(internationalRegex);
  if (intlMatch && intlMatch[0]) {
    const intlDigits = "+" + intlMatch[0].replace(/[^0-9]/g, "");
    return {
      detected: true,
      phoneNumber: intlDigits,
      rawInput: intlMatch[0],
      confidence: 0.92,
      owner: ownership.owner,
      ownerName: ownership.ownerName,
      isCorrection,
      isPartial: false,
      needsConfirmation: false,
      intent: isCorrection ? "UPDATING_PHONE" : "PROVIDING_PHONE",
    };
  }

  return {
    detected: false,
    confidence: 0,
    owner: "SELF",
    isCorrection: false,
    isPartial: false,
    needsConfirmation: false,
    intent: "NON_PHONE",
  };
}
