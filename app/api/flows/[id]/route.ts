import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getCurrentWorkspaceContext, canManageWorkspace } from "@/lib/workspace-access";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getCurrentWorkspaceContext();
    if (!context?.workspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const automation = await prisma.automation.findFirst({
      where: { id, workspaceId: context.workspaceId },
    });

    if (!automation) {
      return NextResponse.json({ error: "Flow not found" }, { status: 404 });
    }

    return NextResponse.json({ flow: automation });
  } catch (error) {
    console.error("[Flow API GET Error]:", error);
    return NextResponse.json({ error: "Failed to fetch flow" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getCurrentWorkspaceContext();
    if (!context?.workspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canManageWorkspace(context.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, isActive, graph } = body;

    const automation = await prisma.automation.findFirst({
      where: { id, workspaceId: context.workspaceId },
    });

    if (!automation) {
      return NextResponse.json({ error: "Flow not found" }, { status: 404 });
    }

    const triggerNode = graph?.nodes?.find((n: any) => n.type === "trigger");
    const dmNode = graph?.nodes?.find((n: any) => n.type === "send_dm");

    // Map FlowBuilder triggerType to Automation enum
    const triggerTypeMap: Record<string, string> = {
      COMMENT_KEYWORD: "COMMENT",
      DIRECT_MESSAGE: "DIRECT_MESSAGE",
      STORY_REPLY: "STORY_REPLY",
      STORY_MENTION: "STORY_MENTION",
    };

    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (graph !== undefined) {
      updateData.flowGraph = graph;
      // Sync flat fields from graph nodes so the automation engine stays in sync
      if (triggerNode?.data?.config) {
        const tc = triggerNode.data.config;
        const rawTrigger = tc.triggerType || "COMMENT_KEYWORD";
        updateData.triggerType = (triggerTypeMap[rawTrigger] || "COMMENT") as any;
        if (tc.keywords !== undefined) updateData.keywords = tc.keywords;
        if (tc.matchAnyPost !== undefined) updateData.matchAnyPost = tc.matchAnyPost;
        if (tc.matchAnyWord !== undefined) updateData.matchAnyWord = tc.matchAnyWord;
        if (tc.wholeWordMatch !== undefined) updateData.wholeWordMatch = tc.wholeWordMatch;
      }
      if (dmNode?.data?.config) {
        const dc = dmNode.data.config;
        if (dc.message !== undefined) updateData.dmMessage = dc.message;
        if (dc.buttonLabel !== undefined) updateData.linkButtonLabel = dc.buttonLabel;
        if (dc.publicReplyEnabled !== undefined) updateData.publicReplyEnabled = dc.publicReplyEnabled;
      }
    }

    const updated = await prisma.automation.update({
      where: { id: automation.id },
      data: updateData,
    });

    return NextResponse.json({ success: true, flow: updated });
  } catch (error) {
    console.error("[Flow API PUT Error]:", error);
    return NextResponse.json({ error: "Failed to update flow" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getCurrentWorkspaceContext();
    if (!context?.workspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canManageWorkspace(context.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const automation = await prisma.automation.findFirst({
      where: { id, workspaceId: context.workspaceId },
    });

    if (!automation) {
      return NextResponse.json({ error: "Flow not found" }, { status: 404 });
    }

    await prisma.automation.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Flow API DELETE Error]:", error);
    return NextResponse.json({ error: "Failed to delete flow" }, { status: 500 });
  }
}
