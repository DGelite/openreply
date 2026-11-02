import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceContext, canManageWorkspace } from "@/lib/workspace-access";
import { prisma } from "@/lib/db/client";
import { getDefaultIranianSchedule } from "@/lib/scheduling/operating-schedule";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/settings/schedule
 * Retrieves operating hours, holidays, and out-of-hours response settings.
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getCurrentWorkspaceContext();
    if (!context?.workspaceId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountIdParam = searchParams.get("accountId");

    const account = accountIdParam
      ? await prisma.instagramAccount.findFirst({
          where: { id: accountIdParam, workspaceId: context.workspaceId },
        })
      : await prisma.instagramAccount.findFirst({
          where: { workspaceId: context.workspaceId },
          orderBy: { connectedAt: "desc" },
        });

    if (!account) {
      return NextResponse.json({
        success: true,
        data: null,
        message: "هیچ اکانت اینستاگرامی متصل نشده است.",
      });
    }

    const schedule = await prisma.operatingSchedule.findUnique({
      where: { instagramAccountId: account.id },
    });

    const defaultSchedule = {
      instagramAccountId: account.id,
      isEnabled: true,
      timezone: "Asia/Tehran",
      schedule: getDefaultIranianSchedule(),
      holidays: [],
      outOfHoursAction: "OUT_OF_OFFICE_MESSAGE",
      outOfHoursMessage: "سلام! در حال حاضر خارج از ساعات کاری هستیم. پیام شما ثبت شد و در اولین فرصت در ساعات اداری با شما تماس خواهیم گرفت.",
    };

    if (!schedule) {
      return NextResponse.json({
        success: true,
        data: defaultSchedule,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        instagramAccountId: account.id,
        isEnabled: schedule.isEnabled,
        timezone: schedule.timezone || "Asia/Tehran",
        schedule: Array.isArray(schedule.scheduleJson) ? schedule.scheduleJson : getDefaultIranianSchedule(),
        holidays: Array.isArray(schedule.holidaysJson) ? schedule.holidaysJson : [],
        outOfHoursAction: schedule.outOfHoursAction,
        outOfHoursMessage: schedule.outOfHoursMessage,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch schedule";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/settings/schedule
 * Updates operating hours, intervals, and out-of-hours actions.
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getCurrentWorkspaceContext();
    if (!context?.workspaceId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!canManageWorkspace(context.role)) {
      return NextResponse.json(
        { success: false, error: "فقط مدیران اجازه تغییر ساعات کاری را دارند." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      accountId,
      isEnabled,
      timezone,
      schedule,
      holidays,
      outOfHoursAction,
      outOfHoursMessage,
    } = body;

    const account = accountId
      ? await prisma.instagramAccount.findFirst({
          where: { id: accountId, workspaceId: context.workspaceId },
        })
      : await prisma.instagramAccount.findFirst({
          where: { workspaceId: context.workspaceId },
          orderBy: { connectedAt: "desc" },
        });

    if (!account) {
      return NextResponse.json(
        { success: false, error: "اکانت اینستاگرام موردنظر یافت نشد." },
        { status: 404 }
      );
    }

    const updated = await prisma.operatingSchedule.upsert({
      where: { instagramAccountId: account.id },
      create: {
        workspaceId: context.workspaceId,
        instagramAccountId: account.id,
        isEnabled: isEnabled ?? true,
        timezone: timezone || "Asia/Tehran",
        scheduleJson: Array.isArray(schedule) ? schedule : getDefaultIranianSchedule(),
        holidaysJson: Array.isArray(holidays) ? holidays : [],
        outOfHoursAction: outOfHoursAction || "OUT_OF_OFFICE_MESSAGE",
        outOfHoursMessage: outOfHoursMessage || null,
      },
      update: {
        isEnabled: isEnabled ?? true,
        timezone: timezone || "Asia/Tehran",
        scheduleJson: Array.isArray(schedule) ? schedule : undefined,
        holidaysJson: Array.isArray(holidays) ? holidays : undefined,
        outOfHoursAction: outOfHoursAction || undefined,
        outOfHoursMessage: outOfHoursMessage !== undefined ? outOfHoursMessage : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      message: "تنظیمات ساعات کاری با موفقیت ذخیره شد.",
      data: updated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update schedule";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
