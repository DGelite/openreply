import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import {
  canManageWorkspace,
  getCurrentWorkspaceContext,
} from "@/lib/workspace-access";
import { BoxApiClient } from "@/lib/providers/boxapi/boxapi-client";
import { getBaseUrl } from "@/lib/env";

export const runtime = "nodejs";

/**
 * POST /api/instagram/connect-boxapi
 * Connects an Instagram account standalone via BoxAPI without requiring Facebook OAuth.
 * Sets the account's primaryProvider to BOXAPI and orchestrationMode to BOXAPI_PRIMARY.
 */
export async function POST(request: NextRequest) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json(
      { success: false, error: "برای اتصال پیج باید وارد حساب کاربری خود شوید." },
      { status: 401 }
    );
  }

  if (!canManageWorkspace(context.role)) {
    return NextResponse.json(
      { success: false, error: "تنها مالکین و مدیران مجاز به اتصال اکانت اینستاگرام هستند." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const {
      username: rawUsername,
      boxAccountId: rawBoxAccountId,
      boxApiKey: rawBoxApiKey,
      boxApiToken: rawBoxApiToken,
      boxWebhookSecret: rawBoxWebhookSecret,
    } = body;

    const username = (rawUsername || "").trim().replace(/^@/, "").toLowerCase();
    const boxAccountId = (rawBoxAccountId || "").trim();
    const boxApiKey = (rawBoxApiKey || "").trim();
    const boxApiToken = (rawBoxApiToken || "").trim();
    const boxWebhookSecret = (rawBoxWebhookSecret || "").trim();

    if (!username) {
      return NextResponse.json(
        { success: false, error: "وارد کردن نام کاربری اینستاگرام (Username) الزامی است." },
        { status: 400 }
      );
    }

    if (!boxApiKey) {
      return NextResponse.json(
        { success: false, error: "وارد کردن کلید API سرویس BoxAPI (X-Api-Key) الزامی است." },
        { status: 400 }
      );
    }

    if (!boxAccountId) {
      return NextResponse.json(
        { success: false, error: "وارد کردن شناسه اکانت BoxAPI (Account ID / UUID) الزامی است." },
        { status: 400 }
      );
    }

    // Optional: Test connection to BoxAPI
    let healthDetails: Record<string, unknown> | null = null;
    try {
      const testClient = new BoxApiClient({
        apiKey: boxApiKey,
        accountId: boxAccountId,
        baseUrl: process.env.BOXAPI_BASE_URL || "https://boxapi.ir",
        timeoutMs: 6000,
      });

      const testRes = await testClient.officialGet("/service/info").catch(() => null);
      if (testRes && testRes.success) {
        healthDetails = (testRes.data as Record<string, unknown>) || null;
      }
    } catch (testErr) {
      console.warn("[ConnectBoxApi] Preflight info test non-blocking failure:", testErr);
    }

    const uniqueInstagramId = boxAccountId || `box_${username}_${Date.now()}`;
    const baseUrl = getBaseUrl();
    const webhookUrl = `${baseUrl}/api/webhook/boxapi`;

    // Check if account already exists in this workspace
    const existing = await prisma.instagramAccount.findFirst({
      where: {
        workspaceId: context.workspaceId,
        OR: [{ username }, { instagramId: uniqueInstagramId }, { boxAccountId }],
      },
    });

    let savedAccount;

    if (existing) {
      savedAccount = await prisma.instagramAccount.update({
        where: { id: existing.id },
        data: {
          username,
          name: username,
          primaryProvider: "BOXAPI",
          orchestrationMode: "BOXAPI_PRIMARY",
          boxAccountId,
          boxApiKey,
          ...(boxApiToken ? { boxApiToken } : {}),
          ...(boxWebhookSecret ? { boxWebhookSecret } : {}),
          boxConnectedAt: new Date(),
          webhookSubscribed: true,
        },
      });
    } else {
      savedAccount = await prisma.instagramAccount.create({
        data: {
          workspaceId: context.workspaceId,
          instagramId: uniqueInstagramId,
          username,
          name: username,
          accessToken: "BOXAPI_STANDALONE",
          primaryProvider: "BOXAPI",
          orchestrationMode: "BOXAPI_PRIMARY",
          boxAccountId,
          boxApiKey,
          boxApiToken: boxApiToken || null,
          boxWebhookSecret: boxWebhookSecret || null,
          boxConnectedAt: new Date(),
          webhookSubscribed: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "اکانت اینستاگرام با موفقیت از طریق BoxAPI متصل شد و به عنوان روش اصلی (Primary) تنظیم گردید.",
      data: {
        accountId: savedAccount.id,
        username: savedAccount.username,
        primaryProvider: savedAccount.primaryProvider,
        orchestrationMode: savedAccount.orchestrationMode,
        boxAccountId: savedAccount.boxAccountId,
        webhookUrl,
        healthDetails,
      },
    });
  } catch (err: unknown) {
    console.error("[ConnectBoxApi] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: (err as Error)?.message || "خطا در اتصال به BoxAPI. لطفاً مشخصات را بررسی کنید.",
      },
      { status: 500 }
    );
  }
}
