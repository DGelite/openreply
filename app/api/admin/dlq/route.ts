import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext, canManageWorkspace } from "@/lib/workspace-access";
import { getDLQMessages, updateDLQStatus } from "@/lib/queue/dlq";
import { prisma } from "@/lib/db/client";

export async function GET() {
  try {
    const context = await getCurrentWorkspaceContext();
    if (!context?.workspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const messages = await getDLQMessages(context.workspaceId);
    return NextResponse.json({ dlqMessages: messages });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const context = await getCurrentWorkspaceContext();
    if (!context?.workspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canManageWorkspace(context.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { id, action } = body; // action: "RETRY" | "RESOLVE" | "IGNORE"

    if (!id || !action) {
      return NextResponse.json({ error: "id and action required" }, { status: 400 });
    }

    const message = await prisma.deadLetterMessage.findFirst({
      where: {
        id,
        OR: [{ workspaceId: context.workspaceId }, { workspaceId: null }],
      },
    });

    if (!message) {
      return NextResponse.json({ error: "DLQ message not found" }, { status: 404 });
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
