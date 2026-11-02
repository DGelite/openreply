/**
 * OpenReply Conversation Strategy & Funnel Progression Engine
 * Directs AI conversations towards business goals without sounding robotic or repetitive.
 */

export type BusinessGoal =
  | "LEAD_GENERATION"
  | "APPOINTMENT_BOOKING"
  | "PRODUCT_SALES"
  | "SUPPORT_RESOLUTION";

export interface StrategyContext {
  primaryGoal: BusinessGoal;
  userMessage: string;
  hasPhone: boolean;
  hasEmail: boolean;
  conversationTurns: number;
  lastAiAskedForPhone: boolean;
  isUnhappy: boolean;
  isRequestingHuman: boolean;
  hasBuyingIntent: boolean;
}

export interface StrategyDecision {
  action: "ANSWER_ONLY" | "PROCEED_TO_PHONE" | "OFFER_BOOKING" | "ESCALATE_TO_HUMAN" | "HANDLE_UNHAPPY";
  guidelineForAi: string;
  suggestedNextStep?: string;
}

/**
 * Detects explicit user request for human operator.
 */
export function isAskingForHuman(text: string): boolean {
  const lower = text.toLowerCase();
  const humanKeywords = [
    "اپراتور",
    "انسان",
    "پشتیبان انسانی",
    "آدم",
    "وصل کن به ادمین",
    "ادمین کیه",
    "با مسئول",
    "مدیریت",
    "شماره تماس مستقیم",
    "وصل کن به کارشناس",
  ];
  return humanKeywords.some((kw) => lower.includes(kw));
}

/**
 * Detects customer frustration or complaint.
 */
export function isCustomerUnhappy(text: string): boolean {
  const lower = text.toLowerCase();
  const complaintKeywords = [
    "شکایت",
    "ناراضی",
    "افتضاح",
    "چرا جواب نمیدید",
    "کلاهبرداری",
    "بدترین",
    "پولم رو پس بدید",
    "پیگیری نمیکنید",
    "سرکار گذاشتید",
    "خراب",
  ];
  return complaintKeywords.some((kw) => lower.includes(kw));
}

/**
 * Detects strong buying, booking, or registration intent.
 */
export function hasStrongBuyingIntent(text: string): boolean {
  const lower = text.toLowerCase();
  const buyKeywords = [
    "میخوام بخرم",
    "می‌خوام بخرم",
    "چطور ثبت نام کنم",
    "ثبت نام",
    "میخوام شرکت کنم",
    "ثبت سفارش",
    "خرید",
    "رزرو کنید",
    "نوبت میخوام",
    "مشاوره میخوام",
    "شماره کارت بفرستید",
    "لینک پرداخت",
  ];
  return buyKeywords.some((kw) => lower.includes(kw));
}

/**
 * Evaluates the conversational state and determines the next strategic guideline.
 */
export function evaluateConversationStrategy(ctx: StrategyContext): StrategyDecision {
  // 1. Explicit human escalation request
  if (ctx.isRequestingHuman || isAskingForHuman(ctx.userMessage)) {
    return {
      action: "ESCALATE_TO_HUMAN",
      guidelineForAi: "مشتری درخواست ارتباط با پشتیبان یا مسئول انسانی کرده است. با احترام کامل بگو درخواست او ثبت شد و به همکاران اطلاع داده شد تا به زودی پیام دهند.",
    };
  }

  // 2. Unhappy customer complaint
  if (ctx.isUnhappy || isCustomerUnhappy(ctx.userMessage)) {
    return {
      action: "HANDLE_UNHAPPY",
      guidelineForAi: "مشتری ناراضی است یا مشکلی دارد. اول با احترام و صمیمیت عذرخواهی و همدردی کن، مشکلش را یادداشت کن و اطمینان بده که موضوع سریعاً بررسی می‌شود. مطلقاً پیشنهاد خرید یا ثبت نام نده.",
    };
  }

  // 3. Strong Buying or Booking Intent
  if (ctx.hasBuyingIntent || hasStrongBuyingIntent(ctx.userMessage)) {
    if (ctx.primaryGoal === "APPOINTMENT_BOOKING") {
      return {
        action: "OFFER_BOOKING",
        guidelineForAi: "مشتری آماده رزرو نوبت یا مشاوره است. شماره تماس همراه او را بخواه تا تایم‌های خالی رزرو برای او ثبت شود.",
      };
    }

    if (!ctx.hasPhone) {
      return {
        action: "PROCEED_TO_PHONE",
        guidelineForAi: "مشتری به خدمات علاقه‌مند است و مایل به ثبت نام یا خرید است. به صورت دوستانه شماره همراهش را بپرس تا جزییات کامل و هماهنگی برایش ارسال شود.",
      };
    }

    return {
      action: "ANSWER_ONLY",
      guidelineForAi: "اطلاعات لازم برای نهایی‌سازی سفارش یا ثبت‌نام را بسیار کوتاه و شفاف توضیح بده و در صورت تمایل او را راهنمایی کن.",
    };
  }

  // 4. Lead Generation Goal with established interest
  if (ctx.primaryGoal === "LEAD_GENERATION" && !ctx.hasPhone) {
    // Anti-nagging rule: If AI already asked for phone in the last turn, don't ask again immediately
    if (ctx.lastAiAskedForPhone) {
      return {
        action: "ANSWER_ONLY",
        guidelineForAi: "فقط به سوال مشتری به صورت شفاف و مختصر پاسخ بده و اصراری روی گرفتن شماره نکن.",
      };
    }

    // If customer has asked at least 2 questions or shows curiosity
    if (ctx.conversationTurns >= 2) {
      return {
        action: "PROCEED_TO_PHONE",
        guidelineForAi: "به سوال مخاطب پاسخ کامل بده و در پایان بگو اگر دوست دارد برای ارسال جزییات یا مشاوره دقیق‌تر شماره تماسش را بفرستد.",
      };
    }
  }

  // 5. Default: Answer question directly and concisely
  return {
    action: "ANSWER_ONLY",
    guidelineForAi: "مستقیماً و بسیار کوتاه به سوال مخاطب پاسخ بده. از پرسیدن سوالات اضافه یا اصرار به دریافت شماره خودداری کن.",
  };
}
