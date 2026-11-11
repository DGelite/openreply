import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/lib/workspace-access";
import { PhpBookingClient } from "@/lib/services/php-booking-client";

function normalizeBookingApiUrl(url: string): string {
  let cleaned = (url || "").trim();
  if (!cleaned) return "https://armintahmasebi.ir/api_openreply.php";

  // If user entered admin.php or domain root, normalize to the active REST gateway
  if (cleaned.endsWith("/admin.php")) {
    cleaned = cleaned.replace(/\/admin\.php$/, "/api_openreply.php");
  } else if (!cleaned.endsWith("/api_openreply.php") && !cleaned.endsWith(".php")) {
    cleaned = cleaned.replace(/\/+$/, "") + "/api_openreply.php";
  }
  return cleaned;
}

export async function GET() {
  try {
    const context = await getCurrentWorkspaceContext();
    if (!context?.workspaceId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const rawApiUrl =
      process.env.BOOKING_API_URL ||
      process.env.PHP_ADMIN_API_URL ||
      "https://armintahmasebi.ir/api_openreply.php";
    const apiUrl = normalizeBookingApiUrl(rawApiUrl);
    const apiSecret = process.env.PHP_ADMIN_API_SECRET || "de_secure_api_key_2026_x892n3m";
    const webhookUrl =
      process.env.OPENREPLY_WEBHOOK_URL || "https://insta.digitalelite.ir/api/webhook/php-booking";

    let isConnected = false;
    let serverTime: string | undefined;

    try {
      const client = new PhpBookingClient(apiUrl, apiSecret, 3500);
      const ping = await client.ping();
      if (ping.success) {
        isConnected = true;
        serverTime = ping.server_time;
      }
    } catch {
      isConnected = false;
    }

    return NextResponse.json({
      success: true,
      data: {
        apiUrl,
        apiSecret: apiSecret ? "••••••••" : "",
        isConfigured: Boolean(apiSecret),
        isConnected,
        serverTime,
        webhookUrl,
        enabled: process.env.PHP_BOOKING_ENABLED !== "false",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load booking settings";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentWorkspaceContext();
    if (!context?.workspaceId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    let { apiUrl, apiSecret } = body;

    if (!apiUrl || apiUrl.includes("localhost/admin.php") || apiUrl.trim() === "") {
      apiUrl =
        process.env.BOOKING_API_URL ||
        process.env.PHP_ADMIN_API_URL ||
        "https://armintahmasebi.ir/api_openreply.php";
    }

    apiUrl = normalizeBookingApiUrl(apiUrl);

    // If placeholder/masked secret was submitted, fallback to server configured secret
    if (!apiSecret || apiSecret.includes("••••") || apiSecret.trim() === "") {
      apiSecret = process.env.PHP_ADMIN_API_SECRET || "de_secure_api_key_2026_x892n3m";
    }

    // Instantiate a fresh client with the provided params
    const testClient = new PhpBookingClient(apiUrl, apiSecret);
    const pingResult = await testClient.ping();

    return NextResponse.json({
      success: pingResult.success,
      message: pingResult.success
        ? `ارتباط زنده با سرور رزرواسیون با موفقیت تأیید شد! (زمان سرور: ${pingResult.server_time || "آنلاین"})`
        : (pingResult.message || "خطا در دریافت پاسخ از درگاه رزرواسیون"),
      data: {
        ...pingResult,
        normalizedUrl: apiUrl,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "خطا در برقراری ارتباط با سرویس رزرو PHP";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
