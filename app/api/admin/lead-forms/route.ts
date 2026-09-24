import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getCurrentWorkspaceContext } from "@/lib/workspace-access";

/**
 * LeadFormField type definition.
 * Stored as JSON in the `fields` column of LeadForm.
 */
export interface LeadFormField {
  id: string;           // Unique field identifier (e.g., "field_1")
  type: "text" | "email" | "phone" | "select" | "textarea" | "checkbox" | "number" | "date";
  label: string;        // Display label (Persian or English)
  placeholder?: string;
  required: boolean;
  options?: string[];   // For select fields
  order: number;        // Display order
}

function generateSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 50) +
    "-" +
    Math.random().toString(36).slice(2, 7)
  );
}

// GET /api/admin/lead-forms — list all forms for workspace
export async function GET(request: NextRequest) {
  try {
    const context = await getCurrentWorkspaceContext();
    let workspaceId = context?.workspaceId;

    if (!workspaceId) {
      const firstWs = await prisma.workspace.findFirst();
      workspaceId = firstWs?.id ?? "main-workspace";
    }

    const forms = await prisma.leadForm.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        isActive: true,
        slug: true,
        viewCount: true,
        submitCount: true,
        fields: true,
        settings: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { submissions: true } },
      },
    });

    return NextResponse.json({ success: true, data: forms });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch lead forms";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/admin/lead-forms — create a new form
export async function POST(request: NextRequest) {
  try {
    const context = await getCurrentWorkspaceContext();
    if (!context?.workspaceId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, fields, settings, isActive } = body;

    if (!title?.trim()) {
      return NextResponse.json({ success: false, error: "عنوان فرم الزامی است." }, { status: 400 });
    }

    if (!Array.isArray(fields) || fields.length === 0) {
      return NextResponse.json(
        { success: false, error: "حداقل یک فیلد برای فرم الزامی است." },
        { status: 400 }
      );
    }

    const slug = generateSlug(title);

    const form = await prisma.leadForm.create({
      data: {
        workspaceId: context.workspaceId,
        title: title.trim(),
        description: description?.trim() || null,
        fields,
        settings: settings || {},
        slug,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json({ success: true, data: form }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create lead form";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
