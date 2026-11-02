import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { encryptToken, safeDecryptToken } from "@/lib/meta/oauth";
import { AiProviderType } from "@/lib/generated/prisma/client";
import { getCurrentWorkspaceContext, canManageWorkspace } from "@/lib/workspace-access";
import { clearAiEngineCache } from "@/lib/ai/factory";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function maskKey(key?: string | null): string {
  if (!key) return "";
  try {
    const dec = safeDecryptToken(key);
    if (!dec) return "";
    if (dec.length <= 8) return "••••••••";
    return `••••••••${dec.slice(-4)}`;
  } catch {
    return "••••••••";
  }
}

export async function GET(request: NextRequest) {
  try {
    const context = await getCurrentWorkspaceContext();
    if (!context?.workspaceId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = context.workspaceId;

    const config = await prisma.aiConfig.findUnique({
      where: { workspaceId },
    });

    const defaultData = {
      workspaceId,
      isEnabled: true,
      provider: "GEMINI",
      model: "gemini-2.5-flash",
      temperature: 0.7,
      maxTokens: 1000,
      brandVoice: null,
      defaultTone: "friendly",
      systemPrompt: null,
      confidenceThreshold: 0.75,
      manualApprovalMode: false,
      activeHoursEnabled: false,
      activeStartTime: "17:00",
      activeEndTime: "08:00",
      timezone: "Asia/Tehran",
      offlineMessage: null,
      assistantName: "مشاور فروش",
      roleTitle: "مشاور ارشد و پشتیبان",
      businessType: "کسب‌وکار و آموزش",
      targetAudience: "مشتریان و متقاضیان",
      personalityDemeanor: "حرفه‌ای، صمیمی، موجز و بدون مبالغه",
      preferredWords: [],
      forbiddenWords: [],
      unhappyClientPolicy: null,
      priceObjectionPolicy: null,
      hesitantClientPolicy: null,
      humanEscalationTriggers: [],
      primaryGoal: "LEAD_GENERATION",
      outOfHoursAction: "OUT_OF_OFFICE_MESSAGE",
      geminiApiKeyMasked: "",
      hasGeminiApiKey: Boolean(process.env.GEMINI_API_KEY),
      geminiModel: "gemini-2.5-flash",
      openAiApiKeyMasked: "",
      hasOpenAiApiKey: Boolean(process.env.OPENAI_API_KEY),
      openAiModel: "gpt-4o-mini",
      boxApiAiEnabled: false,
      boxApiAiKeyMasked: "",
      hasBoxApiAiKey: Boolean(process.env.BOXAPI_DATA_TOKEN || process.env.BOXAPI_API_KEY),
      boxApiAiModel: "gpt-4o-mini",
      boxApiAiBaseUrl: "https://boxapi.ir/api/v1",
      embeddingProvider: "GEMINI",
      embeddingModel: "text-embedding-004",
      allowAiFallback: false,
      lastTestStatus: {},
    };

    if (!config) {
      return NextResponse.json({ success: true, data: defaultData });
    }

    const responseData = {
      ...config,
      geminiApiKeyMasked: maskKey(config.geminiApiKeyEncrypted || config.apiKeyEncrypted),
      hasGeminiApiKey: Boolean(config.geminiApiKeyEncrypted || config.apiKeyEncrypted || process.env.GEMINI_API_KEY),
      geminiModel: config.geminiModel || "gemini-2.5-flash",
      openAiApiKeyMasked: maskKey(config.openAiApiKeyEncrypted || config.apiKeyEncrypted),
      hasOpenAiApiKey: Boolean(config.openAiApiKeyEncrypted || process.env.OPENAI_API_KEY),
      openAiModel: config.openAiModel || "gpt-4o-mini",
      boxApiAiEnabled: Boolean(config.boxApiAiEnabled),
      boxApiAiKeyMasked: maskKey(config.boxApiAiKeyEncrypted),
      hasBoxApiAiKey: Boolean(config.boxApiAiKeyEncrypted || process.env.BOXAPI_DATA_TOKEN || process.env.BOXAPI_API_KEY),
      boxApiAiModel: config.boxApiAiModel || "gpt-4o-mini",
      boxApiAiBaseUrl: config.boxApiAiBaseUrl || "https://boxapi.ir/api/v1",
      embeddingProvider: config.embeddingProvider || "GEMINI",
      embeddingModel: config.embeddingModel || "text-embedding-004",
      allowAiFallback: Boolean(config.allowAiFallback),
      lastTestStatus: config.lastTestStatus || {},
      // Do not return raw encrypted tokens to frontend
      apiKeyEncrypted: undefined,
      geminiApiKeyEncrypted: undefined,
      openAiApiKeyEncrypted: undefined,
      boxApiAiKeyEncrypted: undefined,
    };

    return NextResponse.json(
      { success: true, data: responseData },
      { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch AI config";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getCurrentWorkspaceContext();
    if (!context?.workspaceId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!canManageWorkspace(context.role)) {
      return NextResponse.json(
        { success: false, error: "فقط مدیران اجازه تغییر تنظیمات هوش مصنوعی را دارند." },
        { status: 403 }
      );
    }

    const workspaceId = context.workspaceId;
    const body = await request.json();
    const {
      isEnabled,
      provider,
      model,
      apiKey,
      baseUrl,
      temperature,
      maxTokens,
      brandVoice,
      defaultTone,
      systemPrompt,
      confidenceThreshold,
      manualApprovalMode,
      activeHoursEnabled,
      activeStartTime,
      activeEndTime,
      timezone,
      offlineMessage,
      assistantName,
      roleTitle,
      businessType,
      targetAudience,
      personalityDemeanor,
      preferredWords,
      forbiddenWords,
      unhappyClientPolicy,
      priceObjectionPolicy,
      hesitantClientPolicy,
      humanEscalationTriggers,
      primaryGoal,
      outOfHoursAction,
      // Multi-Provider Credentials & Configuration
      geminiApiKey,
      geminiModel,
      openAiApiKey,
      openAiModel,
      boxApiAiEnabled,
      boxApiAiKey,
      boxApiAiModel,
      boxApiAiBaseUrl,
      embeddingProvider,
      embeddingModel,
      allowAiFallback,
    } = body;

    const encryptedKey = apiKey && typeof apiKey === "string" && apiKey.trim() ? encryptToken(apiKey.trim()) : undefined;
    const encryptedGemini = geminiApiKey && typeof geminiApiKey === "string" && geminiApiKey.trim() ? encryptToken(geminiApiKey.trim()) : undefined;
    const encryptedOpenAi = openAiApiKey && typeof openAiApiKey === "string" && openAiApiKey.trim() ? encryptToken(openAiApiKey.trim()) : undefined;
    const encryptedBoxApi = boxApiAiKey && typeof boxApiAiKey === "string" && boxApiAiKey.trim() ? encryptToken(boxApiAiKey.trim()) : undefined;

    // Safety constraint: If user selected BOXAPI as active chat provider, boxApiAiEnabled MUST be explicitly true
    const effectiveBoxApiEnabled = boxApiAiEnabled !== undefined ? Boolean(boxApiAiEnabled) : undefined;
    if (provider === "BOXAPI" && effectiveBoxApiEnabled === false) {
      return NextResponse.json(
        { success: false, error: "برای انتخاب BoxAPI به عنوان پرووایدر اصلی، تیک فعال‌سازی BoxAPI AI را بزنید." },
        { status: 400 }
      );
    }

    const updatedConfig = await prisma.aiConfig.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        isEnabled: isEnabled ?? true,
        provider: (provider as AiProviderType) || "GEMINI",
        model: model || "gemini-2.5-flash",
        apiKeyEncrypted: encryptedKey,
        baseUrl: baseUrl || null,
        temperature: typeof temperature === "number" ? temperature : 0.7,
        maxTokens: typeof maxTokens === "number" ? maxTokens : 1000,
        brandVoice: brandVoice || null,
        defaultTone: defaultTone || "friendly",
        systemPrompt: systemPrompt || null,
        confidenceThreshold: typeof confidenceThreshold === "number" ? confidenceThreshold : 0.75,
        manualApprovalMode: manualApprovalMode ?? false,
        activeHoursEnabled: activeHoursEnabled ?? false,
        activeStartTime: activeStartTime || null,
        activeEndTime: activeEndTime || null,
        timezone: timezone || "Asia/Tehran",
        offlineMessage: offlineMessage || null,
        assistantName: assistantName || null,
        roleTitle: roleTitle || null,
        businessType: businessType || null,
        targetAudience: targetAudience || null,
        personalityDemeanor: personalityDemeanor || null,
        preferredWords: Array.isArray(preferredWords) ? preferredWords : [],
        forbiddenWords: Array.isArray(forbiddenWords) ? forbiddenWords : [],
        unhappyClientPolicy: unhappyClientPolicy || null,
        priceObjectionPolicy: priceObjectionPolicy || null,
        hesitantClientPolicy: hesitantClientPolicy || null,
        humanEscalationTriggers: Array.isArray(humanEscalationTriggers) ? humanEscalationTriggers : [],
        primaryGoal: primaryGoal || "LEAD_GENERATION",
        outOfHoursAction: outOfHoursAction || "OUT_OF_OFFICE_MESSAGE",
        geminiApiKeyEncrypted: encryptedGemini || encryptedKey,
        geminiModel: geminiModel || "gemini-2.5-flash",
        openAiApiKeyEncrypted: encryptedOpenAi,
        openAiModel: openAiModel || "gpt-4o-mini",
        boxApiAiEnabled: effectiveBoxApiEnabled ?? false,
        boxApiAiKeyEncrypted: encryptedBoxApi,
        boxApiAiModel: boxApiAiModel || "gpt-4o-mini",
        boxApiAiBaseUrl: boxApiAiBaseUrl || "https://boxapi.ir/api/v1",
        embeddingProvider: embeddingProvider || "GEMINI",
        embeddingModel: embeddingModel || "text-embedding-004",
        allowAiFallback: allowAiFallback ?? false,
      },
      update: {
        isEnabled: isEnabled ?? true,
        provider: (provider as AiProviderType) || undefined,
        model: model || undefined,
        ...(encryptedKey ? { apiKeyEncrypted: encryptedKey } : {}),
        baseUrl: baseUrl || undefined,
        temperature: typeof temperature === "number" ? temperature : undefined,
        maxTokens: typeof maxTokens === "number" ? maxTokens : undefined,
        brandVoice: brandVoice || undefined,
        defaultTone: defaultTone || undefined,
        systemPrompt: systemPrompt || undefined,
        confidenceThreshold: typeof confidenceThreshold === "number" ? confidenceThreshold : undefined,
        manualApprovalMode: manualApprovalMode ?? undefined,
        activeHoursEnabled: activeHoursEnabled ?? undefined,
        activeStartTime: activeStartTime || undefined,
        activeEndTime: activeEndTime || undefined,
        timezone: timezone || undefined,
        offlineMessage: offlineMessage || undefined,
        assistantName: assistantName !== undefined ? assistantName : undefined,
        roleTitle: roleTitle !== undefined ? roleTitle : undefined,
        businessType: businessType !== undefined ? businessType : undefined,
        targetAudience: targetAudience !== undefined ? targetAudience : undefined,
        personalityDemeanor: personalityDemeanor !== undefined ? personalityDemeanor : undefined,
        preferredWords: Array.isArray(preferredWords) ? preferredWords : undefined,
        forbiddenWords: Array.isArray(forbiddenWords) ? forbiddenWords : undefined,
        unhappyClientPolicy: unhappyClientPolicy !== undefined ? unhappyClientPolicy : undefined,
        priceObjectionPolicy: priceObjectionPolicy !== undefined ? priceObjectionPolicy : undefined,
        hesitantClientPolicy: hesitantClientPolicy !== undefined ? hesitantClientPolicy : undefined,
        humanEscalationTriggers: Array.isArray(humanEscalationTriggers) ? humanEscalationTriggers : undefined,
        primaryGoal: primaryGoal !== undefined ? primaryGoal : undefined,
        outOfHoursAction: outOfHoursAction !== undefined ? outOfHoursAction : undefined,
        ...(encryptedGemini ? { geminiApiKeyEncrypted: encryptedGemini } : {}),
        geminiModel: geminiModel || undefined,
        ...(encryptedOpenAi ? { openAiApiKeyEncrypted: encryptedOpenAi } : {}),
        openAiModel: openAiModel || undefined,
        boxApiAiEnabled: effectiveBoxApiEnabled !== undefined ? effectiveBoxApiEnabled : undefined,
        ...(encryptedBoxApi ? { boxApiAiKeyEncrypted: encryptedBoxApi } : {}),
        boxApiAiModel: boxApiAiModel || undefined,
        boxApiAiBaseUrl: boxApiAiBaseUrl || undefined,
        embeddingProvider: embeddingProvider || undefined,
        embeddingModel: embeddingModel || undefined,
        allowAiFallback: allowAiFallback !== undefined ? Boolean(allowAiFallback) : undefined,
      },
    });

    // Clear runtime engine caches for this workspace
    clearAiEngineCache(workspaceId);

    return NextResponse.json(
      {
        success: true,
        message: "تنظیمات هوش مصنوعی با موفقیت به‌روزرسانی شد.",
        data: {
          ...updatedConfig,
          geminiApiKeyMasked: maskKey(updatedConfig.geminiApiKeyEncrypted || updatedConfig.apiKeyEncrypted),
          hasGeminiApiKey: Boolean(updatedConfig.geminiApiKeyEncrypted || updatedConfig.apiKeyEncrypted || process.env.GEMINI_API_KEY),
          openAiApiKeyMasked: maskKey(updatedConfig.openAiApiKeyEncrypted),
          hasOpenAiApiKey: Boolean(updatedConfig.openAiApiKeyEncrypted || process.env.OPENAI_API_KEY),
          boxApiAiKeyMasked: maskKey(updatedConfig.boxApiAiKeyEncrypted),
          hasBoxApiAiKey: Boolean(updatedConfig.boxApiAiKeyEncrypted || process.env.BOXAPI_DATA_TOKEN || process.env.BOXAPI_API_KEY),
          apiKeyEncrypted: undefined,
          geminiApiKeyEncrypted: undefined,
          openAiApiKeyEncrypted: undefined,
          boxApiAiKeyEncrypted: undefined,
        },
      },
      { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update AI config";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
