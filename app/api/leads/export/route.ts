import { NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";

export async function GET(request: Request) {
  try {
    const workspaceId = await getCurrentWorkspaceId();
    if (!workspaceId) {
      return NextResponse.json({ error: "Unauthorized or Workspace not found" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "csv";

    const leads = await prisma.lead.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        createdAt: true,
        sourceAutomationId: true,
      },
    });

    if (format === "json") {
      return NextResponse.json({ leads });
    }

    // Generate CSV export
    const headers = ["ID", "Username", "Email", "Phone", "Captured At", "Source Automation ID"];
    const rows = leads.map((l) => [
      l.id,
      l.username || "",
      l.email || "",
      l.phone || "",
      l.createdAt.toISOString(),
      l.sourceAutomationId || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="leads_${workspaceId}_${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    console.error("[Leads Export API Error]:", error);
    return NextResponse.json({ error: "Failed to export leads" }, { status: 500 });
  }
}
