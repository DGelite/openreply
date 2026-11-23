import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { providerManager } from "@/lib/providers/manager/provider-manager";
import { reconcileAllActiveAutomations, reconcileAccountPostComments } from "@/lib/reconciliation/reconciliation-engine";

export const runtime = "nodejs";

/**
 * GET /api/settings/provider
 * Returns the current multi-provider orchestration configuration, failover logs, and health status.
 */
export async function GET(req: NextRequest) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const accountIdParam = searchParams.get("accountId");

  const account = accountIdParam
    ? await prisma.instagramAccount.findFirst({
        where: { id: accountIdParam, workspaceId },
        include: {
          failoverLogs: {
            orderBy: { createdAt: "desc" },
            take: 5,
          },
          reconciliationCheckpoints: {
            orderBy: { lastScannedAt: "desc" },
            take: 5,
          },
        },
      })
    : await prisma.instagramAccount.findFirst({
        where: { workspaceId },
        orderBy: { connectedAt: "desc" },
        include: {
          failoverLogs: {
            orderBy: { createdAt: "desc" },
            take: 5,
          },
          reconciliationCheckpoints: {
            orderBy: { lastScannedAt: "desc" },
            take: 5,
          },
        },
      });

  if (!account) {
    return NextResponse.json({
      success: true,
      data: null,
      message: "No connected Instagram account found in workspace",
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      accountId: account.id,
      username: account.username,
      instagramId: account.instagramId,
      orchestrationMode: account.orchestrationMode,
      primaryProvider: account.primaryProvider,
      backupProvider: account.backupProvider,
      boxAccountId: account.boxAccountId,
      boxApiBaseUrl: account.boxApiBaseUrl || process.env.BOXAPI_BASE_URL || "https://api.sendbox.chat/api/v1",
      hasBoxApiKey: Boolean(account.boxApiKey),
      hasBoxApiToken: Boolean(account.boxApiToken),
      hasBoxWebhookSecret: Boolean(account.boxWebhookSecret),
      boxConnectedAt: account.boxConnectedAt,
      hasMetaToken: Boolean(account.accessToken),
      tokenExpiresAt: account.tokenExpiresAt,
      lastFailoverAt: account.lastFailoverAt,
      failoverCount: account.failoverCount,
      recentFailovers: account.failoverLogs,
      recentCheckpoints: account.reconciliationCheckpoints,
    },
  });
}

/**
 * POST /api/settings/provider
 * Saves provider configuration, tests connection, or triggers reconciliation.
 */
export async function POST(req: NextRequest) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action = "save_config", accountId } = body;

    const account = accountId
      ? await prisma.instagramAccount.findFirst({ where: { id: accountId, workspaceId } })
      : await prisma.instagramAccount.findFirst({ where: { workspaceId }, orderBy: { connectedAt: "desc" } });

    if (!account) {
      if (body.boxApiKey && body.boxAccountId) {
        const fallbackUsername = body.username ? String(body.username).replace(/^@/, "").trim() : `box_${body.boxAccountId}`;
        const newAccount = await prisma.instagramAccount.create({
          data: {
            workspaceId,
            instagramId: body.boxAccountId.trim(),
            username: fallbackUsername,
            name: fallbackUsername,
            accessToken: "BOXAPI_STANDALONE",
            primaryProvider: body.primaryProvider || "BOXAPI",
            orchestrationMode: body.orchestrationMode || "BOXAPI_PRIMARY",
            backupProvider: body.backupProvider || null,
            boxAccountId: body.boxAccountId.trim(),
            boxApiKey: body.boxApiKey.trim(),
            boxApiBaseUrl: body.boxApiBaseUrl ? body.boxApiBaseUrl.trim() : null,
            boxApiToken: body.boxApiToken ? body.boxApiToken.trim() : null,
            boxWebhookSecret: body.boxWebhookSecret ? body.boxWebhookSecret.trim() : null,
            boxConnectedAt: new Date(),
            webhookSubscribed: true,
          },
        });
        return NextResponse.json({
          success: true,
          message: "اکانت اینستاگرام با موفقیت ایجاد و تنظیمات BoxAPI ذخیره شد.",
          data: {
            accountId: newAccount.id,
            orchestrationMode: newAccount.orchestrationMode,
            primaryProvider: newAccount.primaryProvider,
            hasBoxApiKey: true,
            hasBoxApiToken: Boolean(newAccount.boxApiToken),
            hasBoxWebhookSecret: Boolean(newAccount.boxWebhookSecret),
          },
        });
      }

      return NextResponse.json(
        { success: false, error: "Instagram account not found in workspace" },
        { status: 404 }
      );
    }

    // ── Action: Test Connection ──────────────────────────────────────────────
    if (action === "test_connection") {
      const health = await providerManager.testConnection(account.id);
      return NextResponse.json({
        success: health.healthy,
        data: health,
        message: health.healthy
          ? `اتصال به ${health.provider} با موفقیت برقرار شد (تاخیر: ${health.latencyMs}ms)`
          : `خطا در اتصال به ${health.provider}: ${health.error}`,
      });
    }

    // ── Action: Trigger Reconciliation ───────────────────────────────────────
    if (action === "trigger_reconciliation") {
      const report = body.postId
        ? await reconcileAccountPostComments(account.id, body.postId)
        : await reconcileAllActiveAutomations();

      return NextResponse.json({
        success: true,
        data: report,
        message: "حسابرسی Zero-Lead-Loss با موفقیت انجام شد.",
      });
    }

    // ── Action: Save Configuration ───────────────────────────────────────────
    const {
      orchestrationMode,
      primaryProvider,
      backupProvider,
      boxAccountId,
      boxApiKey,
      boxApiBaseUrl,
      boxApiToken,
      boxWebhookSecret,
    } = body;

    const updateData: Record<string, any> = {};

    if (orchestrationMode) {
      updateData.orchestrationMode = orchestrationMode;
    }
    if (primaryProvider) {
      updateData.primaryProvider = primaryProvider;
    }
    if (backupProvider !== undefined) {
      updateData.backupProvider = backupProvider || null;
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let finalBoxAccountId = boxAccountId !== undefined ? (boxAccountId ? boxAccountId.trim() : null) : undefined;

    // Auto-resolve valid UUID if user passed numeric Instagram ID or invalid format
    if (finalBoxAccountId && !uuidRegex.test(finalBoxAccountId)) {
      const activeKey = (boxApiKey && boxApiKey.trim()) || account.boxApiKey;
      const activeBase = (boxApiBaseUrl && boxApiBaseUrl.trim()) || account.boxApiBaseUrl || "https://api.sendbox.chat/api/v1";
      if (activeKey) {
        try {
          const testClient = new BoxApiClient({ apiKey: activeKey, baseUrl: activeBase, timeoutMs: 5000 });
          const infoRes = await testClient.officialGet<{
            accounts?: Array<{ id: string; username?: string; instagram_user_id?: string }>;
          }>("/service/info");
          const accounts = infoRes.data?.accounts || [];
          const matched =
            accounts.find(
              (a) =>
                (account.username && a.username?.toLowerCase() === account.username.toLowerCase()) ||
                (account.instagramId && a.instagram_user_id === account.instagramId)
            ) || accounts[0];
          if (matched?.id && uuidRegex.test(matched.id)) {
            finalBoxAccountId = matched.id;
          }
        } catch (e) {
          console.warn("[SettingsProvider] Auto-resolve UUID failed:", e);
        }
      }
    }

    if (finalBoxAccountId !== undefined) {
      updateData.boxAccountId = finalBoxAccountId;
    }
    if (boxApiBaseUrl !== undefined) {
      updateData.boxApiBaseUrl = boxApiBaseUrl ? boxApiBaseUrl.trim() : null;
    }
    if (boxApiKey && boxApiKey.trim() !== "") {
      updateData.boxApiKey = boxApiKey.trim();
      updateData.boxConnectedAt = new Date();
    }
    if (boxApiToken && boxApiToken.trim() !== "") {
      updateData.boxApiToken = boxApiToken.trim();
    }
    if (boxWebhookSecret && boxWebhookSecret.trim() !== "") {
      updateData.boxWebhookSecret = boxWebhookSecret.trim();
    }

    const updated = await prisma.instagramAccount.update({
      where: { id: account.id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: "تنظیمات Multi-Provider با موفقیت ذخیره شد.",
      data: {
        accountId: updated.id,
        orchestrationMode: updated.orchestrationMode,
        primaryProvider: updated.primaryProvider,
        backupProvider: updated.backupProvider,
        boxAccountId: updated.boxAccountId,
        hasBoxApiKey: Boolean(updated.boxApiKey),
        hasBoxApiToken: Boolean(updated.boxApiToken),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
