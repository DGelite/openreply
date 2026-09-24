import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/lib/workspace-access";
import { smsManagerService } from "@/lib/services/sms-manager-service";

export async function GET() {
  try {
    const context = await getCurrentWorkspaceContext();
    if (!context?.workspaceId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const creditData = await smsManagerService.getCredit();

    return NextResponse.json({
      success: true,
      data: creditData,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطا در استعلام اعتبار پیامک";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
