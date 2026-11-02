import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceContext, canManageWorkspace } from "@/lib/workspace-access";
import { prisma } from "@/lib/db/client";
import { addDocumentToKnowledgeBase, invalidateKnowledgeBaseCache } from "@/lib/ai/features/knowledge-base";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/settings/knowledge
 * Lists all documents in the workspace knowledge base.
 */
export async function GET() {
  try {
    const context = await getCurrentWorkspaceContext();
    if (!context?.workspaceId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const documents = await prisma.knowledgeDocument.findMany({
      where: { workspaceId: context.workspaceId },
      include: {
        _count: {
          select: { chunks: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: documents.map((doc) => ({
        id: doc.id,
        title: doc.title,
        sourceType: doc.sourceType,
        sourceUrl: doc.sourceUrl,
        contentPreview: doc.content.slice(0, 200) + (doc.content.length > 200 ? "..." : ""),
        chunkCount: doc._count.chunks,
        createdAt: doc.createdAt,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch knowledge documents";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/settings/knowledge
 * Indexes a new document and generates vector embeddings.
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getCurrentWorkspaceContext();
    if (!context?.workspaceId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!canManageWorkspace(context.role)) {
      return NextResponse.json(
        { success: false, error: "فقط مدیران اجازه افزودن سند به دانش کسب‌وکار را دارند." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, sourceType, content, sourceUrl } = body;

    if (!title || !content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { success: false, error: "عنوان و متن سند الزامی است." },
        { status: 400 }
      );
    }

    const docId = await addDocumentToKnowledgeBase({
      workspaceId: context.workspaceId,
      title: title.trim(),
      sourceType: sourceType || "DOC",
      sourceUrl: sourceUrl || undefined,
      content: content.trim(),
    });

    return NextResponse.json({
      success: true,
      message: "سند با موفقیت به پایگاه دانش افزوده و ایندکس شد.",
      data: { documentId: docId },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to index knowledge document";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/settings/knowledge
 * Removes a document and its chunks from the knowledge base.
 */
export async function DELETE(request: NextRequest) {
  try {
    const context = await getCurrentWorkspaceContext();
    if (!context?.workspaceId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!canManageWorkspace(context.role)) {
      return NextResponse.json(
        { success: false, error: "فقط مدیران اجازه حذف اسناد را دارند." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { documentId } = body;

    if (!documentId) {
      return NextResponse.json({ success: false, error: "شناسه سند الزامی است." }, { status: 400 });
    }

    const existing = await prisma.knowledgeDocument.findFirst({
      where: { id: documentId, workspaceId: context.workspaceId },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "سند یافت نشد." }, { status: 404 });
    }

    await prisma.knowledgeDocument.delete({
      where: { id: documentId },
    });

    invalidateKnowledgeBaseCache(context.workspaceId);

    return NextResponse.json({
      success: true,
      message: "سند با موفقیت حذف شد.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete document";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
