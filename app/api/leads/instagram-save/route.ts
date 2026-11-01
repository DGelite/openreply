import { NextResponse } from "next/server";
import { savePhoneLeadDirectly, validatePhone } from "@/lib/automation/email-phone-collector";
import { getCurrentWorkspaceContext } from "@/lib/workspace-access";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET || process.env.OPENREPLY_WEBHOOK_SECRET || process.env.PHP_ADMIN_API_SECRET;
    const isSecretAuthorized = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);

    const context = await getCurrentWorkspaceContext();

    if (!context?.workspaceId && !isSecretAuthorized) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { phone, username, igsid, instagramAccountId, automationId } = body;
    const workspaceId = context?.workspaceId || body.workspaceId;

    if (!phone || !igsid || !workspaceId || !instagramAccountId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!validatePhone(phone)) {
      return NextResponse.json(
        { success: false, error: "شماره تلفن وارد شده معتبر نیست." },
        { status: 400 }
      );
    }

    const result = await savePhoneLeadDirectly({
      phone: phone.trim(),
      username,
      igsid,
      workspaceId,
      instagramAccountId,
      automationId,
    });

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save lead directly";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
