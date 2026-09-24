import { NextResponse } from "next/server";
import { getCurrentWorkspaceId, getCurrentUserId } from "@/lib/auth";
import { getDLQMessages, updateDLQStatus } from "@/lib/queue/dlq";

export async function GET() {
  try {
    const workspaceId = await getCurrentWorkspaceId();
    const messages = await getDLQMessages(workspaceId || undefined);
    return NextResponse.json({ dlqMessages: messages });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, action } = body; // action: "RETRY" | "RESOLVE" | "IGNORE"

    if (!id || !action) {
      return NextResponse.json({ error: "id and action required" }, { status: 400 });
    }

    let targetStatus: "RETRIED" | "RESOLVED" | "IGNORED" = "RESOLVED";
    if (action === "RETRY") targetStatus = "RETRIED";
    if (action === "IGNORE") targetStatus = "IGNORED";

    const updated = await updateDLQStatus(id, targetStatus);
    return NextResponse.json({ success: true, message: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
