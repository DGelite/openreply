import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { encryptToken } from "@/lib/meta/oauth";
import { AiProviderType } from "@/lib/generated/prisma/client";
import { getCurrentWorkspaceId } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function resolveWorkspaceId(reqWsId?: string | null): Promise<string> {
  // 1. Check if explicit workspaceId exists in DB
  if (reqWsId) {
    const ws = await prisma.workspace.findUnique({ where: { id: reqWsId } });
    if (ws) return ws.id;
  }

  // 2. Try user active session workspace
  const userWsId = await getCurrentWorkspaceId();
  if (userWsId) {
    const ws = await prisma.workspace.findUnique({ where: { id: userWsId } });
    if (ws) return ws.id;
  }

  // 3. If an AiConfig record already exists in DB, stick to its workspaceId
  const existingConfig = await prisma.aiConfig.findFirst({
    select: { workspaceId: true },
  });
  if (existingConfig) {
    return existingConfig.workspaceId;
  }

  // 4. Fallback to first workspace in DB
  const firstWs = await prisma.workspace.findFirst();
  if (firstWs) return firstWs.id;

  // 5. Create default workspace if table is completely empty
  const anyUser = await prisma.user.findFirst();
  const newWs = await prisma.workspace.upsert({
    where: { id: "main-workspace" },
    create: {
      id: "main-workspace",
      name: "ورک‌اسپیس اصلی",
      ownerId: anyUser?.id ?? "admin-user-01",
    },
    update: {},
  });
  return newWs.id;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const workspaceId = await resolveWorkspaceId(searchParams.get("workspaceId"));

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
    const body = await request.json();
    const {
      workspaceId,
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

    const validWorkspaceId = await resolveWorkspaceId(workspaceId);
    const encryptedKey = apiKey && typeof apiKey === "string" && apiKey.trim() ? encryptToken(apiKey.trim()) : undefined;

    const updatedConfig = await prisma.aiConfig.upsert({
      where: { workspaceId: validWorkspaceId },
      create: {
        workspaceId: validWorkspaceId,
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

