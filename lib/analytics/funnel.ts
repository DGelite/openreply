import { prisma } from "@/lib/db/client";
import { isFeatureEnabled } from "@/lib/flags/feature-flags";

export type FunnelStage =
  | "TRIGGERED"
  | "OPENING_DM_SENT"
  | "MAIN_DM_SENT"
  | "EMAIL_CAPTURED"
  | "PHONE_CAPTURED"
  | "COMPLETED"
  | "CONVERTED";

export async function trackFunnelEvent(params: {
  workspaceId: string;
  automationId?: string;
  userId: string;
  stage: FunnelStage;
  metadata?: any;
}) {
  const enabled = await isFeatureEnabled("FUNNEL", params.workspaceId);
  if (!enabled) return null;

  try {
    return await prisma.funnelEvent.create({
      data: {
        workspaceId: params.workspaceId,
        automationId: params.automationId || null,
        userId: params.userId,
        stage: params.stage,
        metadata: params.metadata || {},
      },
    });
  } catch (error) {
    console.error("Failed to track funnel event:", error);
    return null;
  }
}

export async function getFunnelAnalytics(workspaceId: string, automationId?: string) {
  let events: any[] = [];
  try {
    if (prisma.funnelEvent && typeof (prisma.funnelEvent as any).groupBy === "function") {
      events = await (prisma.funnelEvent as any).groupBy({
        by: ["stage"],
        where: {
          workspaceId,
          ...(automationId ? { automationId } : {}),
        },
        _count: {
          userId: true,
        },
      });
    }
  } catch (error) {
    console.error("Error fetching funnel analytics from DB:", error);
  }

  const stageCounts: Record<string, number> = {
    TRIGGERED: 0,
    OPENING_DM_SENT: 0,
    MAIN_DM_SENT: 0,
    EMAIL_CAPTURED: 0,
    PHONE_CAPTURED: 0,
    COMPLETED: 0,
    CONVERTED: 0,
  };

  events.forEach((e) => {
    stageCounts[e.stage] = e._count.userId;
  });

  const triggered = stageCounts["TRIGGERED"] || 1;
  const converted = stageCounts["CONVERTED"] || stageCounts["COMPLETED"] || 0;
  const overallConversionRate = Math.min(100, Math.round((converted / Math.max(1, triggered)) * 100));

  return {
    stageCounts,
    overallConversionRate,
  };
}
