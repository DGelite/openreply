import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getWorkerHealth } from "@/lib/ops/worker-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckStatus = "ok" | "error";

interface HealthCheck {
  status: CheckStatus;
  detail?: string;
}

async function checkDatabase(): Promise<HealthCheck> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok" };
  } catch (error) {
    return {
      status: "error",
      detail: error instanceof Error ? error.message : "Database check failed",
    };
  }
}

async function checkQueue(): Promise<HealthCheck & { counts?: unknown }> {
  try {
    const jobCountsRaw = await prisma.backgroundJob.groupBy({
      by: ["status"],
      _count: { _all: true },
    });

    const counts = {
      waiting: 0,
      active: 0,
      delayed: 0,
      failed: 0,
    };

    for (const row of jobCountsRaw) {
      if (row.status === "PENDING") counts.waiting = row._count._all;
      if (row.status === "RUNNING") counts.active = row._count._all;
      if (row.status === "FAILED") counts.failed = row._count._all;
    }

    return { status: "ok", counts };
  } catch (error) {
    return {
      status: "error",
      detail: error instanceof Error ? error.message : "Queue check failed",
    };
  }
}

let cachedHealthResponse: { data: any; status: number; expiresAt: number } | null = null;
const HEALTH_CACHE_TTL_MS = 5000; // 5 seconds cache to shield DB from frequent monitoring probes

export async function GET(request: NextRequest) {
  // Liveness probe: verifies process is alive without touching database
  if (request.nextUrl.searchParams.get("probe") === "liveness") {
    return NextResponse.json({
      status: "ok",
      probe: "liveness",
      timestamp: new Date().toISOString(),
    });
  }

  const now = Date.now();
  if (cachedHealthResponse && now < cachedHealthResponse.expiresAt) {
    return NextResponse.json(cachedHealthResponse.data, {
      status: cachedHealthResponse.status,
    });
  }

  const [database, queue, worker] = await Promise.all([
    checkDatabase(),
    checkQueue(),
    getWorkerHealth().catch((error) => ({
      healthy: false,
      heartbeat: null,
      ageMs: null,
      error: error instanceof Error ? error.message : "Worker check failed",
    })),
  ]);

  const healthy = database.status === "ok" && queue.status === "ok" && worker.healthy;
  const status = healthy ? 200 : 503;
  const data = {
    status: healthy ? "ok" : "degraded",
    checks: {
      database,
      queue,
      worker,
    },
  };

  cachedHealthResponse = {
    data,
    status,
    expiresAt: now + HEALTH_CACHE_TTL_MS,
  };

  return NextResponse.json(data, { status });
}
