import { prisma } from "@/lib/db/client";
import { syncLeadToWampCrm } from "./crm-sync";

/**
 * Validates an email address.
 */
export function validateEmail(input: string): boolean {
  if (!input) return false;
  const trimmed = input.trim();
  // Standard RFC 5322 compatible email regex
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
  // Accepts:
  // 1) Iranian domestic format: 09123456789, 09011234567 (11 digits)
  // 2) International format: +989123456789 or +14155552671 (E.164 compliant)
  const iranDomesticRegex = /^09\d{9}$/;
  const internationalRegex = /^\+?[1-9]\d{7,14}$/;

  return iranDomesticRegex.test(trimmed) || internationalRegex.test(trimmed);
}

export interface LeadProcessingResult {
  handled: boolean;
  success: boolean;
  nextStep?: "COMPLETED" | "AWAITING_PHONE" | "AWAITING_EMAIL";
  replyMessage: string;
  capturedData?: { email?: string; phone?: string };
}

/**
 * Processes an incoming conversational message when the user is in an active lead collection state.
 */
export async function processLeadStep(params: {
  workspaceId: string;
  instagramAccountId: string;
  userId: string; // IGSID
  username?: string;
  userMessage: string;
  currentStep: "AWAITING_EMAIL" | "AWAITING_PHONE";
  automationId?: string;
  promptPhoneAfterEmail?: boolean;
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
  } = params;

  const trimmedMessage = userMessage.trim();

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
      },
      update: {
        email,
        username: username ?? undefined,
        sourceAutomationId: automationId ?? undefined,
      },
    });

    void syncLeadToWampCrm({
      email,
      username,
      igsid: userId,
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
      },
      update: {
        phone,
        username: username ?? undefined,
        sourceAutomationId: automationId ?? undefined,
      },
    });

    void syncLeadToWampCrm({
      phone,
      username,
      igsid: userId,
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
}) {
  const { phone, username, igsid, workspaceId, instagramAccountId, automationId } = params;

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
    },
    update: {
      phone,
      username: username ?? undefined,
      sourceAutomationId: automationId ?? undefined,
    },
  });

  // Sync to CRM
  void syncLeadToWampCrm({
    phone,
    username,
    igsid,
    lead_source: "openreply-instagram-direct",
    custom_data: { direct_save_no_otp: true }
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
