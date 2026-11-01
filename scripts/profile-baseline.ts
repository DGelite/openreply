import { prisma } from "../lib/db/client";
import { matchKeywords } from "../lib/utils/keyword-matcher";
import { enqueueJob, dequeueBatch, completeJob } from "../lib/queue/mysql-queue";
import { processDueDripEnrollments } from "../lib/drip/drip-engine";
import { performance } from "node:perf_hooks";

async function measureSystemMemory() {
  if (global.gc) global.gc();
  const mem = process.memoryUsage();
  return {
    rssMB: +(mem.rss / 1024 / 1024).toFixed(2),
    heapTotalMB: +(mem.heapTotal / 1024 / 1024).toFixed(2),
    heapUsedMB: +(mem.heapUsed / 1024 / 1024).toFixed(2),
    externalMB: +(mem.external / 1024 / 1024).toFixed(2),
  };
}

async function benchmarkKeywordMatcher(iterations = 2000) {
  const testPhrases = [
    "سلام وقت بخیر قیمت این کار چنده؟",
    "می‌خواهم بدونم شرایط اقساطی چطوریه",
    "کد تخفیف رو لطفا بفرستید",
    "تخفيف ويژه براي اعضا هست؟",
    "رزرو نوبت مشاوره می‌خوام",
    "خیلی گرونه، ارزون‌تر نمیشه؟",
    "سلام ارسال رایگان دارید؟",
    "Hello do you have discounts?",
  ];
  const keywords = ["قیمت", "اقساط", "تخفیف", "رزرو", "مشاوره", "ارسال رایگان", "discount"];

  const start = performance.now();
  let matches = 0;
  for (let i = 0; i < iterations; i++) {
    const phrase = testPhrases[i % testPhrases.length];
    const res = matchKeywords(phrase, keywords, true);
    if (res.matched) matches++;
  }
  const durationMs = +(performance.now() - start).toFixed(2);
  const throughput = Math.round((iterations / durationMs) * 1000);

  return {
    iterations,
    matches,
    durationMs,
    throughputOpsPerSec: throughput,
    avgLatencyUs: +((durationMs / iterations) * 1000).toFixed(2),
  };
}

async function benchmarkDatabaseQueue(jobCount = 20) {
  // 1. Measure Enqueue Latency
  const enqueueLatencies: number[] = [];
  const jobIds: string[] = [];

  for (let i = 0; i < jobCount; i++) {
    const t0 = performance.now();
    const job = await enqueueJob("benchmark-test-job", {
      testId: i,
      commentId: `bench_comment_${Date.now()}_${i}`,
      messageText: "تست بنچمارک صف پایگاه داده",
    });
    enqueueLatencies.push(performance.now() - t0);
    jobIds.push(job.id);
  }

  // 2. Measure Dequeue Batch Latency
  const tDequeue0 = performance.now();
  const dequeued = await dequeueBatch(jobCount);
  const dequeueBatchDurationMs = +(performance.now() - tDequeue0).toFixed(2);

  // 3. Measure Complete Latency
  const completeLatencies: number[] = [];
  for (const job of dequeued) {
    const t0 = performance.now();
    await completeJob(job.id);
    completeLatencies.push(performance.now() - t0);
  }

  // Clean up benchmark jobs from DB
  await prisma.backgroundJob.deleteMany({
    where: { name: "benchmark-test-job" },
  }).catch(() => {});

  const avgEnqueueMs = +(enqueueLatencies.reduce((a, b) => a + b, 0) / enqueueLatencies.length).toFixed(2);
  const avgCompleteMs = +(completeLatencies.reduce((a, b) => a + b, 0) / (completeLatencies.length || 1)).toFixed(2);

  return {
    jobCount,
    avgEnqueueMs,
    dequeueBatchDurationMs,
    dequeuedCount: dequeued.length,
    avgCompleteMs,
  };
}

async function benchmarkDripScan() {
  const t0 = performance.now();
  await processDueDripEnrollments(10);
  const durationMs = +(performance.now() - t0).toFixed(2);
  return { durationMs };
}

async function main() {
  console.log("==================================================");
  console.log("   OPENREPLY RESOURCE PROFILING & BENCHMARK       ");
  console.log("==================================================");

  const initialMem = await measureSystemMemory();
  console.log("1. Initial Memory:", JSON.stringify(initialMem, null, 2));

  console.log("\n2. Running Keyword Matcher Benchmark (2,000 iterations)...");
  const keywordBench = await benchmarkKeywordMatcher(2000);
  console.log("Keyword Matcher Results:", JSON.stringify(keywordBench, null, 2));

  console.log("\n3. Running Database Queue Benchmark (20 jobs)...");
  const queueBench = await benchmarkDatabaseQueue(20);
  console.log("Queue DB Results:", JSON.stringify(queueBench, null, 2));

  console.log("\n4. Running Drip Scheduler Scan Benchmark...");
  const dripBench = await benchmarkDripScan();
  console.log("Drip Scheduler Scan Results:", JSON.stringify(dripBench, null, 2));

  const postMem = await measureSystemMemory();
  console.log("\n5. Post-Benchmark Memory:", JSON.stringify(postMem, null, 2));

  console.log("\n==================================================");
  console.log("SUMMARY BASELINE JSON:");
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    initialMemory: initialMem,
    postMemory: postMem,
    keywordMatcher: keywordBench,
    queueDatabase: queueBench,
    dripScheduler: dripBench,
  }, null, 2));

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
