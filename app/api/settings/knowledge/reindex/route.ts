import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceContext, canManageWorkspace } from "@/lib/workspace-access";
import { reindexKnowledgeBase } from "@/lib/ai/features/knowledge-base";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const context = await getCurrentWorkspaceContext();
    if (!context?.workspaceId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!canManageWorkspace(context.role)) {
      return NextResponse.json(
        { success: false, error: "فقط مدیران اجازه بازسازی ایندکس پایگاه دانش را دارند." },
        { status: 403 }
      );
    }

    const count = await reindexKnowledgeBase(context.workspaceId);

    return NextResponse.json({
      success: true,
      message: `تعداد ${count} بخش از اسناد با موفقیت بازسازی و برداری‌سازی شد.`,
      reindexedChunks: count,
    });
  } catch (err: any) {
    const message = err instanceof Error ? err.message : "Failed to reindex knowledge base";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
