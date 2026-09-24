import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { phpBookingClient } from "@/lib/services/php-booking-client";

/**
 * Public submission endpoint — no auth required since forms can be public.
 * POST /api/forms/[slug]/submit
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const form = await prisma.leadForm.findUnique({
      where: { slug },
    });

    if (!form || !form.isActive) {
      return NextResponse.json(
        { success: false, error: "فرم یافت نشد یا غیرفعال است." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const submittedData = body as Record<string, unknown>;

    // Validate required fields
    const fieldDefs = form.fields as Array<{
      id: string;
      type: string;
      label: string;
      required: boolean;
    }>;

    for (const field of fieldDefs) {
      if (field.required) {
        const val = submittedData[field.id];
        if (val === undefined || val === null || String(val).trim() === "") {
          return NextResponse.json(
            { success: false, error: `فیلد "${field.label}" الزامی است.` },
            { status: 400 }
          );
        }
      }
    }

    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      null;

    const userAgent = request.headers.get("user-agent") || null;
    const referrer = request.headers.get("referer") || null;

    // Save submission — serialize via JSON roundtrip to satisfy Prisma InputJsonValue
    const submission = await prisma.leadFormSubmission.create({
      data: {
        formId: form.id,
        workspaceId: form.workspaceId,
        // JSON.parse(JSON.stringify()) strips undefined values and satisfies Prisma's type
        data: JSON.parse(JSON.stringify(submittedData)),
        ipAddress,
        userAgent,
        referrer,
      },
    });

    // Increment submit count
    await prisma.leadForm.update({
      where: { id: form.id },
      data: { submitCount: { increment: 1 } },
    });

    // Sync to PHP CRM if enabled
    const settings = form.settings as {
      syncToCrm?: boolean;
      successMessage?: string;
    };

    if (settings?.syncToCrm) {
      // Extract common fields from submitted data
      const emailField = fieldDefs.find((f) => f.type === "email");
      const phoneField = fieldDefs.find((f) => f.type === "phone");

      phpBookingClient
        .syncLead({
          email: emailField ? String(submittedData[emailField.id] ?? "") : undefined,
          phone: phoneField ? String(submittedData[phoneField.id] ?? "") : undefined,
          lead_source: `lead-form:${form.slug}`,
          custom_data: submittedData as Record<string, unknown>,
        })
        .then(async (res) => {
          if (res.success) {
            await prisma.leadFormSubmission.update({
              where: { id: submission.id },
              data: { syncedToCrm: true, crmLeadId: res.crm_lead_id ?? null },
            });
          }
        })
        .catch((err) =>
          console.error("[LeadForm] CRM sync failed:", err instanceof Error ? err.message : err)
        );
    }

    return NextResponse.json({
      success: true,
      message: settings?.successMessage || "اطلاعات شما با موفقیت ثبت شد. متشکریم! 🙏",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Submission failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * GET /api/forms/[slug]/submit — increment view count when form is rendered
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  await prisma.leadForm.updateMany({
    where: { slug },
    data: { viewCount: { increment: 1 } },
  });
  return NextResponse.json({ success: true });
}
