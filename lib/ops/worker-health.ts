import { prisma } from "@/lib/db/client";

const WORKER_HEARTBEAT_TTL_SECONDS = 120;

export interface WorkerHeartbeat {
  status: "running";
  worker: "dm";
  pid: number;
  hostname?: string;
  startedAt?: string;
  checkedAt: string;
}

export interface WorkerHealth {
  healthy: boolean;
  heartbeat: WorkerHeartbeat | null;
  ageMs: number | null;
}

export interface WorkerAlert {
  level: "warning" | "error";
  message: string;
  jobId?: string;
  instagramAccountId?: string;
  commentId?: string;
  createdAt: string;
}

let lastHeartbeat: WorkerHeartbeat | null = null;
let lastStaleHealthCleanupAt = 0;
const HEALTH_CLEANUP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export async function recordWorkerHeartbeat(
  heartbeat: Omit<WorkerHeartbeat, "checkedAt" | "status" | "worker">
) {
  const hb: WorkerHeartbeat = {
    ...heartbeat,
    status: "running",
    worker: "dm",
    checkedAt: new Date().toISOString(),
  };
  lastHeartbeat = hb;

  try {
    await prisma.operationalEvent.create({
      data: {
        source: "HEALTH",
        level: "INFO",
        message: "Worker heartbeat",
        payload: hb as any,
      },
    });

    // Clean up stale health events older than 1 hour periodically (every 15m) to prevent DB bloat
    const nowMs = Date.now();
    if (nowMs - lastStaleHealthCleanupAt >= HEALTH_CLEANUP_INTERVAL_MS) {
      lastStaleHealthCleanupAt = nowMs;
      const oneHourAgo = new Date(nowMs - 3600_000);
      await prisma.operationalEvent.deleteMany({
        where: {
          source: "HEALTH",
          createdAt: { lt: oneHourAgo },
        },
      });
    }
  } catch {
    // Non-fatal if DB write fails
  }
}

export async function getWorkerHealth(): Promise<WorkerHealth> {
  // Check local process memory first
  if (lastHeartbeat) {
    const ageMs = Date.now() - new Date(lastHeartbeat.checkedAt).getTime();
    if (ageMs <= WORKER_HEARTBEAT_TTL_SECONDS * 1000) {
      return {
        healthy: true,
        heartbeat: lastHeartbeat,
        ageMs,
      };
    }
  }

  // Cross-process fallback for VPS multi-process architecture (dedicated worker + web instances)
  try {
    const latestEvent = await prisma.operationalEvent.findFirst({
      where: { source: "HEALTH" },
      orderBy: { createdAt: "desc" },
    });

    if (latestEvent && latestEvent.payload) {
      const hb = latestEvent.payload as unknown as WorkerHeartbeat;
      const checkedAtTime = hb.checkedAt
        ? new Date(hb.checkedAt).getTime()
        : latestEvent.createdAt.getTime();
      const ageMs = Date.now() - checkedAtTime;
      const healthy = ageMs <= WORKER_HEARTBEAT_TTL_SECONDS * 1000;
      return {
        healthy,
        heartbeat: hb,
        ageMs,
      };
    }
  } catch {
    // Fall back gracefully if DB query fails
  }

  return { healthy: true, heartbeat: null, ageMs: 0 };
}

export async function recordWorkerAlert(alert: Omit<WorkerAlert, "createdAt">) {
  try {
    await prisma.operationalEvent.create({
      data: {
        source: "WORKER",
        level: alert.level === "error" ? "ERROR" : "WARNING",
        message: alert.message,
        payload: {
          jobId: alert.jobId,
          instagramAccountId: alert.instagramAccountId,
          commentId: alert.commentId,
        },
      },
    });
  } catch {
    // Ignore logging failures
  }
}

export async function getWorkerAlerts(limit = 10): Promise<WorkerAlert[]> {
  try {
    const events = await prisma.operationalEvent.findMany({
      where: { source: "WORKER" },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return events.map((e) => ({
      level: e.level === "ERROR" ? "error" : "warning",
      message: e.message,
      createdAt: e.createdAt.toISOString(),
    }));
  } catch {
    return [];
  }
}
