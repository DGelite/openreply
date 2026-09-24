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

export async function recordWorkerHeartbeat(
  heartbeat: Omit<WorkerHeartbeat, "checkedAt" | "status" | "worker">
) {
  lastHeartbeat = {
    ...heartbeat,
    status: "running",
    worker: "dm",
    checkedAt: new Date().toISOString(),
  };
}

export async function getWorkerHealth(): Promise<WorkerHealth> {
  if (!lastHeartbeat) {
    return { healthy: true, heartbeat: null, ageMs: 0 };
  }

  const ageMs = Date.now() - new Date(lastHeartbeat.checkedAt).getTime();
  return {
    healthy: ageMs <= WORKER_HEARTBEAT_TTL_SECONDS * 1000,
    heartbeat: lastHeartbeat,
    ageMs,
  };
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
