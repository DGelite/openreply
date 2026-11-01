import { prisma } from "../lib/db/client";
import { dequeueBatch } from "../lib/queue/mysql-queue";

function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

async function runWarmup() {
  console.log("Running warmup cycles to prime connection pools and query caches...");
  for (let i = 0; i < 2; i++) {
    const job = await prisma.backgroundJob.create({
      data: {
        name: "warmup-job",
        payload: { instagramAccountId: "warmup_acc", userId: `warmup_user_${i}` },
        status: "PENDING",
      },
    });
    await dequeueBatch(5);
    await prisma.backgroundJob.deleteMany({ where: { id: job.id } });
  }
  console.log("Warmup complete.\n");
}

async function benchmarkBatchSizes() {
  const BATCH_SIZES = [5, 10, 20];
  const ITERATIONS = 30;

  console.log("==========================================================================");
  console.log("    CLAIM COST BENCHMARK (P50, P95, Latency & Query Count)               ");
  console.log("==========================================================================");

  for (const batchSize of BATCH_SIZES) {
    const latencies: number[] = [];
    const perJobLatencies: number[] = [];

    for (let iter = 0; iter < ITERATIONS; iter++) {
      // 1. Seed batch
      const now = new Date();
      const createData = Array.from({ length: batchSize }).map((_, i) => ({
        name: "bench-process-comment",
        payload: {
          instagramAccountId: `acc_bench_${i % 3}`,
          commenterId: `user_bench_${iter}_${i}`,
          commentText: `benchmark comment payload ${i}`,
        },
        status: "PENDING" as const,
        runAt: now,
      }));

      await prisma.backgroundJob.createMany({ data: createData });

      // 2. Measure dequeueBatch
      const t0 = performance.now();
      const claimed = await dequeueBatch(batchSize);
      const duration = performance.now() - t0;

      latencies.push(duration);
      if (claimed.length > 0) {
        perJobLatencies.push(duration / claimed.length);
      }

      // 3. Clean up
      if (claimed.length > 0) {
        await prisma.backgroundJob.deleteMany({
          where: { id: { in: claimed.map((c: any) => c.id) } },
        });
      }
    }

    const p50 = calculatePercentile(latencies, 50);
    const p95 = calculatePercentile(latencies, 95);
    const avgPerJob = calculatePercentile(perJobLatencies, 50);

    console.log(`\n--- Batch Size: ${batchSize} (${ITERATIONS} runs) ---`);
    console.log(`  - Total Queries per Batch: ~${batchSize + 3} queries (1 find RUNNING, 1 find candidates, ${batchSize} atomic claims, 1 fetch claimed)`);
    console.log(`  - P50 (Median) Batch Claim Time: ${p50.toFixed(2)} ms`);
    console.log(`  - P95 Batch Claim Time:         ${p95.toFixed(2)} ms`);
    console.log(`  - P50 Amortized Time per Job:    ${avgPerJob.toFixed(2)} ms/job`);
  }
}

async function benchmarkRunningJobsScanCost() {
  console.log("\n==========================================================================");
  console.log("    COST OF SCANNING ACTIVE RUNNING JOBS UNDER VARYING LOAD              ");
  console.log("==========================================================================");

  const RUNNING_COUNTS = [0, 10, 50];

  for (const count of RUNNING_COUNTS) {
    // Seed running jobs
    const createdIds: string[] = [];
    if (count > 0) {
      const data = Array.from({ length: count }).map((_, i) => ({
        name: "running-job",
        payload: { instagramAccountId: "acc_active", userId: `user_active_${i}` },
        status: "RUNNING" as const,
        lockedAt: new Date(),
      }));
      await prisma.backgroundJob.createMany({ data });
    }

    // Benchmark the scan query
    const scanLatencies: number[] = [];
    for (let i = 0; i < 10; i++) {
      const t0 = performance.now();
      await prisma.backgroundJob.findMany({
        where: { status: "RUNNING" },
        select: { payload: true },
      });
      scanLatencies.push(performance.now() - t0);
    }

    const p50 = calculatePercentile(scanLatencies, 50);
    const p95 = calculatePercentile(scanLatencies, 95);

    console.log(`[Active RUNNING Jobs = ${count}] -> P50 Scan: ${p50.toFixed(2)} ms | P95 Scan: ${p95.toFixed(2)} ms`);

    // Clean up
    if (count > 0) {
      await prisma.backgroundJob.deleteMany({
        where: { name: "running-job" },
      });
    }
  }
}

async function benchmarkConcurrentWorkerContention() {
  console.log("\n==========================================================================");
  console.log("    CONCURRENT WORKER RACE & COLLISION BENCHMARK (Dual Worker)           ");
  console.log("==========================================================================");

  const CONTESTED_COUNT = 20;
  const now = new Date();

  // Create 20 pending jobs (10 for conv A, 10 for conv B)
  const jobsData = Array.from({ length: CONTESTED_COUNT }).map((_, i) => ({
    name: "contested-job",
    payload: {
      instagramAccountId: "acc_contested",
      userId: i % 2 === 0 ? "user_A" : "user_B",
      msgIndex: i,
    },
    status: "PENDING" as const,
    runAt: now,
  }));

  await prisma.backgroundJob.createMany({ data: jobsData });

  console.log(`Created ${CONTESTED_COUNT} pending jobs for 2 conversations (user_A, user_B).`);
  console.log("Simulating Worker 1 and Worker 2 calling dequeueBatch(10) concurrently at the exact same millisecond...");

  const t0 = performance.now();
  const [worker1Batch, worker2Batch] = await Promise.all([
    dequeueBatch(10),
    dequeueBatch(10),
  ]);
  const duration = performance.now() - t0;

  console.log(`Dual-Worker Dequeue Complete in ${duration.toFixed(2)} ms.`);
  console.log(`  - Worker 1 Claimed: ${worker1Batch.length} jobs`);
  console.log(`  - Worker 2 Claimed: ${worker2Batch.length} jobs`);

  // Verify conversation mutual exclusion:
  // Neither user_A nor user_B should be claimed by BOTH workers!
  const w1Users = new Set(worker1Batch.map((j: any) => (j.payload as any).userId));
  const w2Users = new Set(worker2Batch.map((j: any) => (j.payload as any).userId));

  let collisionCount = 0;
  for (const u of w1Users) {
    if (w2Users.has(u)) {
      collisionCount++;
    }
  }

  console.log(`  - Overlapping Conversations: ${collisionCount} (Must be 0!)`);
  if (collisionCount === 0) {
    console.log("  - VERIFICATION: 100% Mutual Exclusion across workers confirmed.");
  } else {
    console.error("  - VIOLATION: Conversation collision detected!");
  }

  // Clean up
  await prisma.backgroundJob.deleteMany({
    where: { name: "contested-job" },
  });
}

async function main() {
  try {
    await runWarmup();
    await benchmarkBatchSizes();
    await benchmarkRunningJobsScanCost();
    await benchmarkConcurrentWorkerContention();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
