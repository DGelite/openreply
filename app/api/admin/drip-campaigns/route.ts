import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");

    const campaigns = await prisma.dripCampaign.findMany({
      where: workspaceId ? { workspaceId } : undefined,
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
    const body = await request.json();
    const { workspaceId, name, triggerType, triggerKey, steps } = body;

    if (!workspaceId || !name) {
      return NextResponse.json(
        { success: false, error: "workspaceId and name are required" },
        { status: 400 }
      );
    }

    const campaign = await prisma.dripCampaign.create({
      data: {
        workspaceId,
        name,
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
