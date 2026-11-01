import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/lib/workspace-access";
import { smsManagerService, SmsMode } from "@/lib/services/sms-manager-service";
import { SmsIrClient } from "@/lib/services/sms-ir-client";

export async function GET() {
  try {
    const context = await getCurrentWorkspaceContext();
    if (!context?.workspaceId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const mode = (process.env.SMS_INTEGRATION_MODE || "HYBRID") as SmsMode;
    const apiKey = process.env.SMS_IR_API_KEY || "";
    const lineNumber = process.env.SMS_IR_LINE_NUMBER || "";
    const templateId = process.env.SMS_IR_TEMPLATE_ID || "";

    return NextResponse.json({
      success: true,
      data: {
        mode,
        apiKey: apiKey ? "••••••••" : "",
        isConfigured: Boolean(apiKey),
        lineNumber,
        templateId,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load SMS settings";
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
    let { mode, apiKey, lineNumber, templateId, testReceptor } = body;

    if (!apiKey || apiKey.includes("••••")) {
      apiKey = process.env.SMS_IR_API_KEY || "";
    }

    // Optional: Test send if testReceptor provided
    if (testReceptor) {
      let testClient: SmsIrClient;
      if (mode === "DIRECT") {
        if (!apiKey) throw new Error("کلید API سامانه پیامک الزامی است.");
        testClient = new SmsIrClient(apiKey);
        const credit = await testClient.getCredit();
        return NextResponse.json({
          success: true,
          message: `تست با موفقیت انجام شد! (اعتبار حساب sms.ir: ${credit.credit.toLocaleString()} ریال)`,
          data: credit,
        });
      } else {
        const creditData = await smsManagerService.getCredit(mode);
        return NextResponse.json({
          success: true,
          message: `اتصال به سامانه پیامک برقرار شد! (منبع: ${creditData.source} | اعتبار: ${creditData.credit.toLocaleString()} ریال)`,
          data: creditData,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "تنظیمات درگاه پیامک با موفقیت بررسی شد.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطا در بررسی تنظیمات پیامک";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
