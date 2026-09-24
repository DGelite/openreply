import { NextResponse } from "next/server";
import { savePhoneLeadDirectly, validatePhone } from "@/lib/automation/email-phone-collector";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, username, igsid, workspaceId, instagramAccountId, automationId } = body;

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
