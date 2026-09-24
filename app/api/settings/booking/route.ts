import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/lib/workspace-access";
import { PhpBookingClient } from "@/lib/services/php-booking-client";

export async function GET() {
  try {
    const context = await getCurrentWorkspaceContext();
    if (!context?.workspaceId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const apiUrl = process.env.PHP_ADMIN_API_URL || "http://localhost/admin.php";
    const apiSecret = process.env.PHP_ADMIN_API_SECRET || "de_secure_api_key_2026_x892n3m";

    return NextResponse.json({
      success: true,
      data: {
        apiUrl,
        apiSecret,
        enabled: true,
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
    const { apiUrl, apiSecret } = body;

    if (!apiUrl || !apiSecret) {
      return NextResponse.json(
        { success: false, error: "آدرس API و کلید راز الزامی است." },
        { status: 400 }
      );
    }

    // Instantiate a fresh client with the provided params
    const testClient = new PhpBookingClient(apiUrl, apiSecret);
    const pingResult = await testClient.ping();

    return NextResponse.json({
      success: pingResult.success,
      message: pingResult.success
        ? `اتصال با موفقیت برقرار شد! سرور: ${pingResult.server_time || "آنلاین"}`
        : pingResult.message,
      data: pingResult,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "خطا در برقراری ارتباط با سرویس رزرو PHP";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
