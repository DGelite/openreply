import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getCurrentWorkspaceContext, canManageWorkspace } from "@/lib/workspace-access";

export async function GET() {
  try {
    const context = await getCurrentWorkspaceContext();
    if (!context?.workspaceId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const campaigns = await prisma.dripCampaign.findMany({
      where: { workspaceId: context.workspaceId },
      include: {
        steps: {
          orderBy: { stepOrder: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: campaigns });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch drip campaigns";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentWorkspaceContext();
    if (!context?.workspaceId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!canManageWorkspace(context.role)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, triggerType, triggerKey, steps } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: "نام کمپین الزامی است." },
        { status: 400 }
      );
    }

    const campaign = await prisma.dripCampaign.create({
      data: {
        workspaceId: context.workspaceId,
        name: name.trim(),
        triggerType: triggerType || "TAG_ADDED",
        triggerKey: triggerKey || null,
        steps: {
          create: (steps || []).map((step: any, idx: number) => ({
            stepOrder: idx + 1,
            delayMinutes: step.delayMinutes ?? 60,
            messageText: step.messageText,
            mediaUrl: step.mediaUrl || null,
          })),
        },
      },
      include: {
        steps: true,
      },
    });

    return NextResponse.json({ success: true, data: campaign });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create drip campaign";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
