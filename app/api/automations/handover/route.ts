import { NextResponse } from "next/server";
import { getCurrentWorkspaceId, getCurrentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { setHumanHandover } from "@/lib/automation/human-handover";

export async function GET() {
  try {
    const workspaceId = await getCurrentWorkspaceId();
    if (!workspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const handovers = await prisma.conversationState.findMany({
      where: {
        workspaceId,
        isHumanHandover: true,
      },
      orderBy: { handoverAt: "desc" },
    });

    return NextResponse.json({ handovers });
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

    const workspaceId = await getCurrentWorkspaceId();
    if (!workspaceId) {
      return NextResponse.json({ error: "Workspace required" }, { status: 400 });
    }

    const body = await req.json();
    const { instagramAccountId, customerUserId, isHandover } = body;

    if (!instagramAccountId || !customerUserId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const state = await setHumanHandover(workspaceId, instagramAccountId, customerUserId, Boolean(isHandover));

    return NextResponse.json({ success: true, state });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
