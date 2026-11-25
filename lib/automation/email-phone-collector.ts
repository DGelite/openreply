import { prisma } from "@/lib/db/client";
import { syncLeadToWampCrm } from "./crm-sync";
import { SmsIrClient } from "@/lib/services/sms-ir-client";
import { extractPhoneNumber, normalizeNumerals } from "@/lib/ai/phone-extractor";
import { normalizeLeadData, isValidHumanName } from "@/lib/ai/lead-normalizer";

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
 * Validates Iranian mobile numbers (e.g. 09123456789, +989123456789, ۰۹۱۲۳۴۵۶۷۸۹)
 * as well as international phone numbers (+1234567890).
 */
export function validatePhone(input: string): boolean {
  if (!input) return false;
  const extraction = extractPhoneNumber({ messageText: input });
  return extraction.detected && Boolean(extraction.phoneNumber);
}

export interface LeadProcessingResult {
  handled: boolean;
  success: boolean;
  nextStep?: "COMPLETED" | "AWAITING_NAME" | "AWAITING_PHONE" | "AWAITING_EMAIL" | "AWAITING_OTP";
  replyMessage: string;
  capturedData?: { email?: string; phone?: string; name?: string };
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
  currentStep: "AWAITING_NAME" | "AWAITING_EMAIL" | "AWAITING_PHONE" | "AWAITING_OTP";
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

  // ── 0. Awaiting Name Step ──────────────────────────────────────────────────
  if (currentStep === "AWAITING_NAME") {
    if (!trimmedMessage || trimmedMessage.length < 2) {
      return {
        handled: true,
        success: false,
        replyMessage: "لطفاً اسم و فامیلتون رو کامل‌تر برام بفرستید 🙏",
      };
    }

    // AI Silent Normalizer with Fast-Path (0 tokens if clean, resilient to full sentences)
    const norm = await normalizeLeadData({
      workspaceId,
      userMessage: trimmedMessage,
      expectedField: "name",
      mode: "SILENT_NORMALIZE_ONLY",
    });

    const name = isValidHumanName(norm.fullName) ? norm.fullName!.trim() : null;
    const phoneFromNorm = norm.phone;
    const notesFromNorm = norm.notes;

    // NEVER save numbers (e.g. "122"), greetings, or invalid text as a person's name!
    if (!name) {
      if (phoneFromNorm) {
        await prisma.lead.upsert({
          where: { id: `lead_${instagramAccountId}_${userId}` },
          create: {
            id: `lead_${instagramAccountId}_${userId}`,
            workspaceId,
            instagramAccountId,
            userId,
            username,
            phone: phoneFromNorm,
            phoneNotes: notesFromNorm || undefined,
            sourceAutomationId: automationId,
            provider,
            externalUserId,
            crmSyncStatus: "PENDING",
          },
          update: {
            phone: phoneFromNorm,
            phoneNotes: notesFromNorm || undefined,
            username: username ?? undefined,
            sourceAutomationId: automationId ?? undefined,
            provider,
            externalUserId: externalUserId ?? undefined,
          },
        });
        return {
          handled: true,
          success: false,
          nextStep: "AWAITING_NAME",
          replyMessage: "مرسی، شماره‌تون رو نگه داشتم 👍 لطفاً اسم و فامیلتون رو هم برام بنویسید تا تکمیل بشه 🙏",
          capturedData: { phone: phoneFromNorm },
        };
      }

      const askAgainMsg = norm.replyMessageToUser
        ? `${norm.replyMessageToUser}\n\nلطفاً اسم و فامیل واقعیتون رو برام بنویسید تا بتونم ثبتش کنم 🙏`
        : "لطفاً اسم و فامیل واقعیتون رو برام بنویسید تا بتونم ثبتش کنم 🙏";

      return {
        handled: true,
        success: false,
        nextStep: "AWAITING_NAME",
        replyMessage: askAgainMsg,
      };
    }

    // Save lead name and any co-extracted phone/notes
    const savedLead = await prisma.lead.upsert({
      where: { id: `lead_${instagramAccountId}_${userId}` },
      create: {
        id: `lead_${instagramAccountId}_${userId}`,
        workspaceId,
        instagramAccountId,
        userId,
        username,
        name,
        phone: phoneFromNorm || undefined,
        phoneNotes: notesFromNorm || undefined,
        sourceAutomationId: automationId,
        provider,
        externalUserId,
        crmSyncStatus: "PENDING",
      },
      update: {
        name,
        username: username ?? undefined,
        phone: phoneFromNorm || undefined,
        phoneNotes: notesFromNorm || undefined,
        sourceAutomationId: automationId ?? undefined,
        provider,
        externalUserId: externalUserId ?? undefined,
      },
    });

    const automation = automationId
      ? await prisma.automation.findUnique({ where: { id: automationId } })
      : null;

    const hasVerifiedPhoneAlready = Boolean(savedLead.phone && savedLead.phoneVerified);
    if (automation?.collectPhone && !hasVerifiedPhoneAlready) {
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

      const phonePromptBase =
        automation.leadPromptPhone ||
        `ممنون ${name} جان! 🙏 لطفاً شماره موبایلتون رو هم بفرستید:`;
      const phonePrompt = norm.replyMessageToUser
        ? `${norm.replyMessageToUser}\n\n${phonePromptBase}`
        : phonePromptBase;

      return {
        handled: true,
        success: true,
        nextStep: "AWAITING_PHONE",
        replyMessage: phonePrompt,
        capturedData: { name },
      };
    }

    // Name-only collection complete!
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

    void syncLeadToWampCrm({
      leadId: `lead_${instagramAccountId}_${userId}`,
      full_name: name,
      phone: savedLead.phone || phoneFromNorm || undefined,
      username,
      igsid: userId,
      instagramAccountId,
      provider,
      externalUserId,
      lead_source: `campaign:${automation?.name || automationId}`,
      auto_verify_and_book: Boolean(automation?.autoVerifyAndBook),
    });

    return {
      handled: true,
      success: true,
      nextStep: "COMPLETED",
      replyMessage:
        automation?.leadSuccessMessage ||
        `عالیه ${name} جان! اطلاعاتتون با موفقیت ثبت شد 🙏`,
      capturedData: { name },
    };
  }

  // ── 1. Awaiting Email Step ─────────────────────────────────────────────────
  if (currentStep === "AWAITING_EMAIL") {
    if (!validateEmail(trimmedMessage)) {
      return {
        handled: true,
        success: false,
        replyMessage:
          "ایمیل معتبر نیست؛ لطفاً یه ایمیل درست بفرستید (مثلاً name@example.com) 🙏",
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
          "ایمیلتون با موفقیت ثبت شد 👍\nلطفاً شماره موبایلتون رو هم برام بفرستید:",
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
    // AI Silent Normalizer with Fast-Path (0 tokens if clean phone, resilient to sentences/questions)
    const norm = await normalizeLeadData({
      workspaceId,
      userMessage: trimmedMessage,
      expectedField: "phone",
      mode: "SILENT_NORMALIZE_ONLY",
    });

    const phone = norm.phone;
    if (!phone) {
      const retryPrompt =
        "شماره موبایل درست نیست؛ لطفاً شماره‌تون رو کامل بفرستید (مثلاً 09123456789) 🙏";
      return {
        handled: true,
        success: false,
        replyMessage: norm.replyMessageToUser
          ? `${norm.replyMessageToUser}\n\n${retryPrompt}`
          : retryPrompt,
      };
    }

    const notesFromNorm = norm.notes;
    const nameFromNorm = norm.fullName;

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
          name: nameFromNorm || undefined,
          phone,
          phoneNotes: notesFromNorm || undefined,
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
          name: nameFromNorm || undefined,
          phoneNotes: notesFromNorm || undefined,
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
        ? "یه کد تایید ۵ رقمی براتون پیامک شد، لطفاً همون کد رو اینجا بفرستید:"
        : `کد تایید شما: ${otpCode}\nلطفاً این کد رو برای تایید شماره‌تون بفرستید:`;

      return {
        handled: true,
        success: true,
        nextStep: "AWAITING_OTP",
        replyMessage: otpNotice,
        capturedData: { phone },
      };
    }

    const automation = automationId
      ? await prisma.automation.findUnique({ where: { id: automationId } })
      : null;

    const leadRecord = await prisma.lead.findUnique({
      where: { id: `lead_${instagramAccountId}_${userId}` },
    });

    if (automation?.confirmBeforeSave) {
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
          metadata: {
            pendingConfirmation: {
              type: "phone",
              value: phone,
              automationId,
            },
          },
        },
        update: {
          metadata: {
            pendingConfirmation: {
              type: "phone",
              value: phone,
              automationId,
            },
          },
        },
      });

      const confirmText = automation.confirmMessage
        ? automation.confirmMessage
            .replace(/{phone}/g, phone)
            .replace(/{value}/g, phone)
        : `شماره‌تون ${phone} ثبت شد، درسته؟`;

      return {
        handled: true,
        success: true,
        replyMessage: confirmText,
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
        name: nameFromNorm || undefined,
        phone,
        phoneNotes: notesFromNorm || undefined,
        sourceAutomationId: automationId,
        provider,
        externalUserId,
        phoneVerified: true,
        crmSyncStatus: "PENDING",
      },
      update: {
        phone,
        name: nameFromNorm || undefined,
        phoneNotes: notesFromNorm || undefined,
        username: username ?? undefined,
        sourceAutomationId: automationId ?? undefined,
        provider,
        externalUserId: externalUserId ?? undefined,
        phoneVerified: true,
      },
    });

    const validStoredName = isValidHumanName(leadRecord?.name) ? leadRecord!.name! : undefined;

    void syncLeadToWampCrm({
      leadId: `lead_${instagramAccountId}_${userId}`,
      phone,
      full_name: nameFromNorm || validStoredName || undefined,
      username,
      igsid: userId,
      instagramAccountId,
      provider,
      externalUserId,
      lead_source: `campaign:${automation?.name || automationId || "phone-collector"}`,
      auto_verify_and_book: Boolean(automation?.autoVerifyAndBook),
      custom_data: notesFromNorm ? { lead_notes: notesFromNorm } : undefined,
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
      replyMessage:
        automation?.leadSuccessMessage ||
        "عالیه! شماره‌تون با موفقیت ثبت شد، خیلی زود باهاتون تماس می‌گیریم 🙏",
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
        replyMessage: "زمان کد تایید تموم شده؛ لطفاً شماره‌تون رو دوباره بفرستید:",
        nextStep: "AWAITING_PHONE",
      };
    }

    if (Date.now() > lead.otpExpiresAt.getTime()) {
      return {
        handled: true,
        success: false,
        replyMessage: "کد تایید منقضی شده؛ لطفاً شماره‌تون رو دوباره بفرستید:",
        nextStep: "AWAITING_PHONE",
      };
    }

    if (lead.otpAttempts >= 4) {
      return {
        handled: true,
        success: false,
        replyMessage: "تعداد تلاش‌ها زیاد بود؛ لطفاً چند دقیقه دیگه شماره‌تون رو بفرستید:",
        nextStep: "COMPLETED",
      };
    }

    const cleanOtp = normalizeNumerals(trimmedMessage).replace(/[^0-9]/g, "");
    if (cleanOtp !== lead.otpCode) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { otpAttempts: { increment: 1 } },
      });

      return {
        handled: true,
        success: false,
        replyMessage: "کد اشتباهه؛ لطفاً کد ۵ رقمی که براتون ارسال شده رو دقیق‌تر بفرستید:",
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
      replyMessage: "عالیه! شماره‌تون با موفقیت تایید و ثبت شد، ممنون از شما 🙏",
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
