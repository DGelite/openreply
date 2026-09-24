import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/lib/workspace-access";
import { smsManagerService } from "@/lib/services/sms-manager-service";

export async function POST(request: Request) {
  try {
    const context = await getCurrentWorkspaceContext();
    if (!context?.workspaceId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { receptor, templateId, parameters, message, mode, type } = body;

    if (!receptor) {
      return NextResponse.json({ success: false, error: "شماره موبایل گیرنده الزامی است." }, { status: 400 });
    }

    const result = await smsManagerService.sendSms({
      mode,
      type,
      receptor,
      templateId,
      parameters,
      message,
    });

    return NextResponse.json({
      success: true,
      message: "پیامک با موفقیت ارسال گردید.",
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطا در ارسال پیامک";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
