import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getCurrentWorkspaceContext } from "@/lib/workspace-access";

// GET /api/admin/lead-forms/[id] — get single form with submissions
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getCurrentWorkspaceContext();
    if (!context?.workspaceId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const form = await prisma.leadForm.findFirst({
      where: { id, workspaceId: context.workspaceId },
      include: {
        submissions: {
          orderBy: { createdAt: "desc" },
          take: 100,
        },
      },
    });

    if (!form) {
      return NextResponse.json({ success: false, error: "Form not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: form });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch form";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// PATCH /api/admin/lead-forms/[id] — update form
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getCurrentWorkspaceContext();
    if (!context?.workspaceId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { title, description, fields, settings, isActive } = body;

    const existing = await prisma.leadForm.findFirst({
      where: { id, workspaceId: context.workspaceId },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Form not found" }, { status: 404 });
    }

    const updated = await prisma.leadForm.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: title.trim() } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
        ...(fields !== undefined ? { fields } : {}),
        ...(settings !== undefined ? { settings } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update form";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE /api/admin/lead-forms/[id] — delete form
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getCurrentWorkspaceContext();
    if (!context?.workspaceId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.leadForm.findFirst({
      where: { id, workspaceId: context.workspaceId },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Form not found" }, { status: 404 });
    }

    await prisma.leadForm.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete form";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
