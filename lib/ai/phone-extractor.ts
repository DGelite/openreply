/**
 * OpenReply Intelligent Phone Extraction & Normalization Engine
 * Enterprise-grade parser for conversational Iranian & International phone numbers in Instagram DMs.
 * Features:
 * - Multi-language digit normalization (Persian, Arabic, English)
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
 * Normalizes Persian and Arabic numerals to ASCII English digits.
 */
export function normalizeNumerals(input: string): string {
  if (!input) return "";

  const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  const arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

  let normalized = input;

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

  // 2. Postal Tracking Code (24 digits)
  if (digitsOnly.length === 24 || (lower.includes("کد رهگیری") && digitsOnly.length > 12)) {
    return { isFalsePositive: true, reason: "Postal Tracking Code" };
  }

  // 3. Price / Monetary Amount indicator
  const moneyKeywords = ["تومان", "تومن", "ریال", "هزار", "میلیون", "میلیارد", "تخفیف", "قیمت", "هزینه", "مبلغ", "واریز", "فیش"];
  if (moneyKeywords.some((kw) => lower.includes(kw)) && !lower.includes("شماره") && !lower.includes("تماس") && !lower.includes("موبایل")) {
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

  return { isFalsePositive: false };
}

/**
 * Normalizes an Iranian mobile phone number to standard 09xxxxxxxxx 11-digit string.
 */
export function normalizeIranianPhone(digits: string): string | null {
  // 1) Starts with +98 or 0098
  if (digits.startsWith("00989") && digits.length === 14) {
    return "0" + digits.substring(4);
  }
  if (digits.startsWith("989") && digits.length === 12) {
    return "0" + digits.substring(2);
  }
  // 2) Starts with 9 and has 10 digits (e.g. 9123456789)
  if (digits.startsWith("9") && digits.length === 10) {
    return "0" + digits;
  }
  // 3) Standard 09xxxxxxxxx with 11 digits
  if (digits.startsWith("09") && digits.length === 11) {
    return digits;
  }

  return null;
}

/**
 * Detects if the message is explicitly expressing future intent to send a phone number.
 */
export function detectIntentToProvidePhone(text: string): boolean {
  const lower = text.toLowerCase();
  const intentPhrases = [
    "الان شماره می‌فرستم",
    "الان شماره میفرستم",
    "شماره بدم",
    "شماره بفرستم",
    "شماره میدم",
    "شماره می‌دم",
    "میخوام شماره بدم",
    "می‌خوام شماره بفرستم",
    "تماس بگیرید شماره بدم",
    "کجا شماره بفرستم",
  ];

  return intentPhrases.some((phrase) => lower.includes(phrase));
}

/**
 * Detects if message is a phone number correction.
 */
export function detectPhoneCorrection(text: string): boolean {
  const lower = text.toLowerCase();
  const correctionKeywords = [
    "اشتباه شد",
    "ببخشید اشتباه",
    "شماره قبلی اشتباه",
    "شماره درست اینه",
    "شماره اصلی اینه",
    "اصلاح میکنم",
    "اصلاح می‌کنم",
    "این درسته",
    "دست خورد",
    "غلط نوشتم",
  ];

  return correctionKeywords.some((phrase) => lower.includes(phrase));
}

/**
 * Detects whether the phone number belongs to a third party.
 */
export function detectPhoneOwnership(text: string): { owner: "SELF" | "THIRD_PARTY"; ownerName?: string } {
  const lower = text.toLowerCase();

  const thirdPartyRegex = /(شماره\s+)?(دوستم|همسرم|برادرم|خواهرم|همکارم|پدرم|مادرم|مدیرم|آقای|خانم)\s*([^\s:،,]+)?/i;
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
  // If there's an active buffer from a recent message (< 3 minutes)
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
  // Patterns like: 0912 345 6789, 0912-345-6789, +989123456789, 09123456789
  const phoneScanRegex = /(?:(?:\+|00)?98\s*|0)?9\s*[0-9\s\-_()]{8,14}[0-9]/g;
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
        } else if (rawClean.includes("شماره") || rawClean.includes("تماس") || rawClean.includes("زنگ")) {
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

  // 8. International E.164 phone numbers (e.g. +14155552671)
  const internationalRegex = /\+([1-9][0-9]{8,14})\b/g;
  const intlMatch = candidateText.match(internationalRegex);
  if (intlMatch && intlMatch[0]) {
    const intlDigits = intlMatch[0];
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
