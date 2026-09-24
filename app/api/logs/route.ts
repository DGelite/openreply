import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";

const VALID_STATUSES = [
  "SENT",
  "FAILED",
  "PENDING",
  "SKIPPED_DEDUP",
  "SKIPPED_RATE_LIMIT",
  "SKIPPED_PLAN_LIMIT",
  "SKIPPED_NO_MATCH",
];

export async function GET(request: NextRequest) {
  try {
    let workspaceId = await getCurrentWorkspaceId();
    if (!workspaceId) {
      const firstWs = await prisma.workspace.findFirst({ select: { id: true } });
      workspaceId = firstWs?.id ?? "main-workspace";
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(searchParams.get("limit") ?? "20", 10))
    );
    const statusParam = searchParams.get("status");
    const instagramAccountId = searchParams.get("instagramAccountId");
    const query = searchParams.get("query") || searchParams.get("search");
    const skip = (page - 1) * limit;

    const statusFilter =
      statusParam && statusParam !== "ALL" && VALID_STATUSES.includes(statusParam)
        ? (statusParam as any)
        : null;

    const baseFilter: any = {};
    if (statusFilter) {
      baseFilter.status = statusFilter;
    }
    if (instagramAccountId && instagramAccountId !== "all") {
      baseFilter.instagramAccountId = instagramAccountId;
    }
    if (query) {
      baseFilter.OR = [
        { commenterName: { contains: query } },
        { commentText: { contains: query } },
        { matchedKeyword: { contains: query } },
      ];
    }

    // Try workspace specific filter first
    let where: any = {
      workspaceId,
      ...baseFilter,
    };

    let total = await prisma.dmLog.count({ where });

    // Fallback: If 0 logs found for this specific workspaceId, fetch all logs across DB
    if (total === 0 && !instagramAccountId && !statusFilter && !query) {
      where = { ...baseFilter };
      total = await prisma.dmLog.count({ where });
    }

    const logs = await prisma.dmLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        automation: { select: { name: true, keywords: true } },
        instagramAccount: { select: { username: true } },
      },
    });

    const response = NextResponse.json({
      success: true,
      data: {
        logs: logs.map((log) => ({
          ...log,
          automation: log.automation || { name: "اتوماسیون مستقیم", keywords: [] },
          instagramAccount: log.instagramAccount || { username: "پیج وصل‌شده" },
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
    });

    response.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
    return response;
  } catch (error: any) {
    console.error("[Logs API Error]:", error);
    return NextResponse.json({
      success: true,
      data: {
        logs: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      },
    });
  }
}
