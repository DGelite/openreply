import { NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";

export async function GET() {
  try {
    const workspaceId = await getCurrentWorkspaceId();
    if (!workspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const automations = await prisma.automation.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        triggerType: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        dmMessage: true,
        flowGraph: true,
      },
    });

    return NextResponse.json({ flows: automations });
  } catch (error) {
    console.error("[Flows API GET Error]:", error);
    return NextResponse.json({ error: "Failed to fetch flows" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    let workspaceId = await getCurrentWorkspaceId();
    if (!workspaceId) {
      const firstWs = await prisma.workspace.findFirst();
      workspaceId = firstWs?.id ?? "main-workspace";
    }

    const body = await request.json();
    const { name, graph } = body;

    let account = await prisma.instagramAccount.findFirst({
      where: { workspaceId },
      select: { id: true },
    });

    if (!account) {
      const anyAccount = await prisma.instagramAccount.findFirst({ select: { id: true } });
      if (anyAccount) {
        account = anyAccount;
      } else {
        account = await prisma.instagramAccount.create({
          data: {
            workspaceId,
            instagramId: `sys-ig-${Date.now()}`,
            username: "system_account",
            accessToken: "system_token",
          },
        });
      }
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
    const rawTrigger = triggerNode?.data?.config?.triggerType || "COMMENT_KEYWORD";
    const mappedTriggerType = triggerTypeMap[rawTrigger] || "COMMENT";

    const automation = await prisma.automation.create({
      data: {
        workspaceId,
        instagramAccountId: account.id,
        name: name || "فلوی جدید اتوماسیون",
        triggerType: mappedTriggerType as any,
        matchAnyPost: triggerNode?.data?.config?.matchAnyPost ?? false,
        keywords: triggerNode?.data?.config?.keywords || ["قیمت"],
        matchAnyWord: triggerNode?.data?.config?.matchAnyWord ?? false,
        wholeWordMatch: triggerNode?.data?.config?.wholeWordMatch ?? true,
        dmMessage: dmNode?.data?.config?.message || "سلام! پیام ارسال شد.",
        linkButtonLabel: dmNode?.data?.config?.buttonLabel || null,
        publicReplyEnabled: dmNode?.data?.config?.publicReplyEnabled ?? false,
        isActive: true,
        flowGraph: graph ?? undefined,
      },
    });

    return NextResponse.json({ flow: automation }, { status: 201 });
  } catch (error) {
    console.error("[Flows API POST Error]:", error);
    return NextResponse.json({ error: "Failed to create flow" }, { status: 500 });
  }
}
