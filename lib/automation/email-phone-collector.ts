import { prisma } from "@/lib/db/client";
import { syncLeadToWampCrm } from "./crm-sync";
import { SmsIrClient } from "@/lib/services/sms-ir-client";

/**
 * Validates an email address.
 */
export function validateEmail(input: string): boolean {
  if (!input) return false;
  const trimmed = input.trim();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(trimmed);
}

/**
 * Validates Iranian mobile numbers (e.g. 09123456789, +989123456789)
 * as well as international phone numbers (+1234567890).
 */
export function validatePhone(input: string): boolean {
  if (!input) return false;
  const trimmed = input.trim();
  const iranDomesticRegex = /^09\d{9}$/;
  const internationalRegex = /^\+?[1-9]\d{7,14}$/;

  return iranDomesticRegex.test(trimmed) || internationalRegex.test(trimmed);
}

export interface LeadProcessingResult {
  handled: boolean;
  success: boolean;
  nextStep?: "COMPLETED" | "AWAITING_PHONE" | "AWAITING_EMAIL" | "AWAITING_OTP";
  replyMessage: string;
  capturedData?: { email?: string; phone?: string };
}

/**
 * Processes an incoming conversational message when the user is in an active lead collection state.
 */
export async function processLeadStep(params: {
  workspaceId: string;
  instagramAccountId: string;
  userId: string; // IGSID or provider-scoped ID
  username?: string;
  userMessage: string;
  currentStep: "AWAITING_EMAIL" | "AWAITING_PHONE" | "AWAITING_OTP";
  automationId?: string;
  promptPhoneAfterEmail?: boolean;
  requireOtp?: boolean;
  provider?: "META" | "BOXAPI";
  externalUserId?: string;
}): Promise<LeadProcessingResult> {
  const {
    workspaceId,
    instagramAccountId,
    userId,
    username,
    userMessage,
    currentStep,
    automationId,
    promptPhoneAfterEmail,
    requireOtp = false,
    provider = "META",
    externalUserId,
  } = params;

  const trimmedMessage = userMessage.trim();

  // ── 1. Awaiting Email Step ─────────────────────────────────────────────────
  if (currentStep === "AWAITING_EMAIL") {
    if (!validateEmail(trimmedMessage)) {
      return {
        handled: true,
        success: false,
        replyMessage:
          "ایمیل وارد شده معتبر نیست. لطفاً یک آدرس ایمیل معتبر (مانند name@example.com) وارد کنید:",
      };
    }

    const email = trimmedMessage.toLowerCase();

    // Save lead
    await prisma.lead.upsert({
      where: { id: `lead_${instagramAccountId}_${userId}` },
      create: {
        id: `lead_${instagramAccountId}_${userId}`,
        workspaceId,
        instagramAccountId,
        userId,
        username,
        email,
        sourceAutomationId: automationId,
        provider,
        externalUserId,
        crmSyncStatus: "PENDING",
      },
      update: {
        email,
        username: username ?? undefined,
        sourceAutomationId: automationId ?? undefined,
        provider,
        externalUserId: externalUserId ?? undefined,
      },
    });

    void syncLeadToWampCrm({
      leadId: `lead_${instagramAccountId}_${userId}`,
      email,
      username,
      igsid: userId,
      instagramAccountId,
      provider,
      externalUserId,
      lead_source: "openreply-email-collector",
    });

    if (promptPhoneAfterEmail) {
      await prisma.conversationState.upsert({
        where: {
          instagramAccountId_userId: { instagramAccountId, userId },
        },
        create: {
          workspaceId,
          instagramAccountId,
          userId,
          step: "AWAITING_PHONE",
          automationId,
        },
        update: {
          step: "AWAITING_PHONE",
          automationId,
        },
      });

      return {
        handled: true,
        success: true,
        nextStep: "AWAITING_PHONE",
        replyMessage:
          "ایمیل شما با موفقیت ثبت شد! 👍\nلطفاً شماره همراه خود را نیز وارد کنید:",
        capturedData: { email },
      };
    }

    // Reset state to COMPLETED
    await prisma.conversationState.upsert({
      where: {
        instagramAccountId_userId: { instagramAccountId, userId },
      },
      create: {
        workspaceId,
        instagramAccountId,
        userId,
        step: "COMPLETED",
        automationId,
      },
      update: {
        step: "COMPLETED",
      },
    });

    return {
      handled: true,
      success: true,
      nextStep: "COMPLETED",
      replyMessage: "اطلاعات شما با موفقیت ثبت شد. متشکریم! 🙏",
      capturedData: { email },
    };
  }

  // ── 2. Awaiting Phone Step ─────────────────────────────────────────────────
  if (currentStep === "AWAITING_PHONE") {
    if (!validatePhone(trimmedMessage)) {
      return {
        handled: true,
        success: false,
        replyMessage:
          "شماره همراه وارد شده معتبر نیست. لطفاً شماره خود را به صورت صحیح (مانند 09123456789) وارد کنید:",
      };
    }

    const phone = trimmedMessage;

    // Check if OTP verification is requested
    if (requireOtp) {
      const otpCode = Math.floor(10000 + Math.random() * 90000).toString();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      await prisma.lead.upsert({
        where: { id: `lead_${instagramAccountId}_${userId}` },
        create: {
          id: `lead_${instagramAccountId}_${userId}`,
          workspaceId,
          instagramAccountId,
          userId,
          username,
          phone,
          sourceAutomationId: automationId,
          provider,
          externalUserId,
          otpCode,
          otpExpiresAt: expiresAt,
          otpAttempts: 0,
          otpChannel: "SMS",
          phoneVerified: false,
          crmSyncStatus: "PENDING",
        },
        update: {
          phone,
          username: username ?? undefined,
          sourceAutomationId: automationId ?? undefined,
          provider,
          externalUserId: externalUserId ?? undefined,
          otpCode,
          otpExpiresAt: expiresAt,
          otpAttempts: 0,
          phoneVerified: false,
        },
      });

      // Send SMS OTP if SMS.ir is configured
      let smsSent = false;
      if (process.env.SMS_IR_API_KEY) {
        try {
          const smsClient = new SmsIrClient();
          const templateId = process.env.SMS_IR_VERIFY_TEMPLATE_ID || "100000";
          await smsClient.sendPattern(phone, templateId, { Code: otpCode });
          smsSent = true;
        } catch (smsErr) {
          console.warn("[Lead Collector] SMS.ir OTP dispatch failed:", smsErr);
        }
      }

      await prisma.conversationState.upsert({
        where: {
          instagramAccountId_userId: { instagramAccountId, userId },
        },
        create: {
          workspaceId,
          instagramAccountId,
          userId,
          step: "AWAITING_OTP",
          automationId,
        },
        update: {
          step: "AWAITING_OTP",
          automationId,
        },
      });

      const otpNotice = smsSent
        ? "کد تأیید ۵ رقمی به شماره شما پیامک شد. لطفاً آن را اینجا ارسال کنید:"
        : `کد تأیید شماره شما: ${otpCode}\nلطفاً برای تأیید شماره، این کد را ارسال کنید:`;

      return {
        handled: true,
        success: true,
        nextStep: "AWAITING_OTP",
        replyMessage: otpNotice,
        capturedData: { phone },
      };
    }

    // Direct phone save without OTP
    await prisma.lead.upsert({
      where: { id: `lead_${instagramAccountId}_${userId}` },
      create: {
        id: `lead_${instagramAccountId}_${userId}`,
        workspaceId,
        instagramAccountId,
        userId,
        username,
        phone,
        sourceAutomationId: automationId,
        provider,
        externalUserId,
        phoneVerified: true,
        crmSyncStatus: "PENDING",
      },
      update: {
        phone,
        username: username ?? undefined,
        sourceAutomationId: automationId ?? undefined,
        provider,
        externalUserId: externalUserId ?? undefined,
        phoneVerified: true,
      },
    });

    void syncLeadToWampCrm({
      leadId: `lead_${instagramAccountId}_${userId}`,
      phone,
      username,
      igsid: userId,
      instagramAccountId,
      provider,
      externalUserId,
      lead_source: "openreply-phone-collector",
    });

    await prisma.conversationState.upsert({
      where: {
        instagramAccountId_userId: { instagramAccountId, userId },
      },
      create: {
        workspaceId,
        instagramAccountId,
        userId,
        step: "COMPLETED",
        automationId,
      },
      update: {
        step: "COMPLETED",
      },
    });

    return {
      handled: true,
      success: true,
      nextStep: "COMPLETED",
      replyMessage: "شماره همراه شما با موفقیت ذخیره شد. متشکریم! 🙏",
      capturedData: { phone },
    };
  }

  // ── 3. Awaiting OTP Step ───────────────────────────────────────────────────
  if (currentStep === "AWAITING_OTP") {
    const lead = await prisma.lead.findUnique({
      where: { id: `lead_${instagramAccountId}_${userId}` },
    });

    if (!lead || !lead.otpCode || !lead.otpExpiresAt) {
      return {
        handled: true,
        success: false,
        replyMessage: "جلسه اعتبارسنجی منقضی شده است. لطفاً شماره خود را دوباره ارسال کنید:",
        nextStep: "AWAITING_PHONE",
      };
    }

    if (Date.now() > lead.otpExpiresAt.getTime()) {
      return {
        handled: true,
        success: false,
        replyMessage: "کد تأیید منقضی شده است. لطفاً شماره خود را مجدداً وارد نمایید:",
        nextStep: "AWAITING_PHONE",
      };
    }

    if (lead.otpAttempts >= 4) {
      return {
        handled: true,
        success: false,
        replyMessage: "تعداد دفعات تلاش بیش از حد مجاز بود. لطفاً دقایقی دیگر شماره خود را وارد نمایید:",
        nextStep: "COMPLETED",
      };
    }

    if (trimmedMessage !== lead.otpCode) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { otpAttempts: { increment: 1 } },
      });

      return {
        handled: true,
        success: false,
        replyMessage: "کد وارد شده صحیح نیست. لطفاً کد ۵ رقمی را با دقت وارد کنید:",
      };
    }

    // OTP Verified!
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        phoneVerified: true,
        otpCode: null,
        otpExpiresAt: null,
        crmSyncStatus: "PENDING",
      },
    });

    void syncLeadToWampCrm({
      leadId: lead.id,
      phone: lead.phone || undefined,
      email: lead.email || undefined,
      username: lead.username || undefined,
      igsid: userId,
      instagramAccountId,
      provider: lead.provider as any,
      externalUserId: lead.externalUserId || undefined,
      lead_source: "openreply-verified-otp",
    });

    await prisma.conversationState.upsert({
      where: {
        instagramAccountId_userId: { instagramAccountId, userId },
      },
      create: {
        workspaceId,
        instagramAccountId,
        userId,
        step: "COMPLETED",
        automationId,
      },
      update: {
        step: "COMPLETED",
      },
    });

    return {
      handled: true,
      success: true,
      nextStep: "COMPLETED",
      replyMessage: "شماره همراه شما با موفقیت تأیید و ثبت شد! متشکریم 🙏",
      capturedData: { phone: lead.phone || undefined },
    };
  }

  return {
    handled: false,
    success: false,
    replyMessage: "",
  };
}

/**
 * Directly saves a phone number as a lead without going through the DM conversation flow (no OTP).
 * Used when collectPhoneSkipOtp is true and the user sends a valid phone number.
 */
export async function savePhoneLeadDirectly(params: {
  phone: string;
  username?: string;
  igsid: string;
  workspaceId: string;
  instagramAccountId: string;
  automationId?: string;
  provider?: "META" | "BOXAPI";
  externalUserId?: string;
}) {
  const {
    phone,
    username,
    igsid,
    workspaceId,
    instagramAccountId,
    automationId,
    provider = "META",
    externalUserId,
  } = params;

  // Save lead
  await prisma.lead.upsert({
    where: { id: `lead_${instagramAccountId}_${igsid}` },
    create: {
      id: `lead_${instagramAccountId}_${igsid}`,
      workspaceId,
      instagramAccountId,
      userId: igsid,
      username,
      phone,
      sourceAutomationId: automationId,
      provider,
      externalUserId,
      phoneVerified: true,
      crmSyncStatus: "PENDING",
    },
    update: {
      phone,
      username: username ?? undefined,
      sourceAutomationId: automationId ?? undefined,
      provider,
      externalUserId: externalUserId ?? undefined,
      phoneVerified: true,
    },
  });

  // Sync to CRM
  void syncLeadToWampCrm({
    leadId: `lead_${instagramAccountId}_${igsid}`,
    phone,
    username,
    igsid,
    instagramAccountId,
    provider,
    externalUserId,
    lead_source: "openreply-instagram-direct",
    custom_data: { direct_save_no_otp: true },
  }).catch((err) => {
    console.error("Failed to sync direct phone lead to CRM:", err);
  });

  // Mark conversation state as COMPLETED if it exists
  await prisma.conversationState.updateMany({
    where: {
      instagramAccountId,
      userId: igsid,
    },
    data: {
      step: "COMPLETED",
      automationId,
    },
  });

  return { success: true, message: "شماره شما با موفقیت ثبت شد." };
}
