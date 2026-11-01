import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { encryptToken } from "@/lib/meta/oauth";
import { AiProviderType } from "@/lib/generated/prisma/client";
import { getCurrentWorkspaceContext, canManageWorkspace } from "@/lib/workspace-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    };

    return NextResponse.json(
      {
        success: true,
        data: config || defaultData,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0, must-revalidate",
        },
      }
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
    } = body;

    const encryptedKey = apiKey && typeof apiKey === "string" && apiKey.trim() ? encryptToken(apiKey.trim()) : undefined;

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
      },
      update: {
        isEnabled: isEnabled ?? true,
        provider: (provider as AiProviderType) || "GEMINI",
        model: model || "gemini-2.5-flash",
        ...(encryptedKey ? { apiKeyEncrypted: encryptedKey } : {}),
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
      },
    });

    return NextResponse.json(
      { success: true, data: updatedConfig },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0, must-revalidate",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update AI config";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
