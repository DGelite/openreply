import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

function escapeCsvField(field: unknown): string {
  if (field === null || field === undefined) return '""';
  const str = String(field);
  // Prevent CSV injection (=, +, -, @ at start of field)
  const safeStr = /^[=+\-@]/.test(str) ? `'${str}` : str;
  return `"${safeStr.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  try {
    const workspaceId = await getCurrentWorkspaceId();
    if (!workspaceId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const automationId = searchParams.get("automationId");
    const provider = searchParams.get("provider");

    const leads = await prisma.lead.findMany({
      where: {
        workspaceId,
        ...(automationId ? { sourceAutomationId: automationId } : {}),
        ...(provider ? { provider: provider as any } : {}),
      },
      include: {
        automation: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const headers = [
      "شناسه",
      "نام و نام خانوادگی",
      "شماره همراه",
      "نام کاربری اینستاگرام",
      "کمپین / فلو",
      "توضیحات و یادداشت‌ها",
      "سرویس‌دهنده",
      "وضعیت CRM",
      "شناسه CRM",
      "تاریخ ثبت",
    ];

    const rows = leads.map((l) => {
      const createdAtJalali = new Date(l.createdAt).toLocaleString("fa-IR", {
        timeZone: "Asia/Tehran",
      });

      return [
        escapeCsvField(l.id),
        escapeCsvField(l.name || "—"),
        escapeCsvField(l.phone || "—"),
        escapeCsvField(l.username ? `@${l.username}` : "—"),
        escapeCsvField(l.automation?.name || l.sourceAutomationId || "عمومی"),
        escapeCsvField(l.phoneNotes || "—"),
        escapeCsvField(l.provider),
        escapeCsvField(l.crmSyncStatus),
        escapeCsvField(l.crmLeadId || "—"),
        escapeCsvField(createdAtJalali),
      ].join(",");
    });

    // UTF-8 BOM (\uFEFF) ensures Persian text opens properly in Microsoft Excel
    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `openreply_leads_${dateStr}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[Leads CSV Export] Error:", err);
    return NextResponse.json({ success: false, error: "Failed to export leads" }, { status: 500 });
  }
}
