import { dequeueBatch, completeJob, failJob, POSTBACK_JOB_NAME } from "./mysql-queue";
import { processComment, processPostback, recordProcessorFailure } from "./processor";
import { recordWorkerHeartbeat } from "@/lib/ops/worker-health";
import { reconcileComments } from "@/lib/polling/comment-reconciler";
import { processIncomingDirectMessage } from "@/lib/automation/direct-message-processor";
import { processDueDripEnrollments } from "@/lib/drip/drip-engine";
import os from "node:os";

const globalForWorker = globalThis as unknown as {
  workerStarted?: boolean;
};

const HEARTBEAT_INTERVAL_MS = 30_000;
const POLL_INTERVAL_MS = Number(process.env.COMMENT_POLL_INTERVAL_MS ?? 5 * 60_000);
const DRIP_INTERVAL_MS = 20_000; // Check and fire scheduled drip sequence steps every 20s

// ── Concurrency & Throughput Settings ─────────────────────────────────────
// ManyChat processes webhooks in real-time. We match that by:
// - Larger batch sizes (process more jobs per loop)
// - Shorter inter-job jitter (500ms) — compliant with Meta v25.0
//   which allows up to 2 calls per second for Conversations API. 
//   500ms stagger = exactly 2 msgs/sec max.
const BATCH_SIZE = Number(process.env.WORKER_BATCH_SIZE ?? 15);
const JOB_STAGGER_MS = Number(process.env.WORKER_JOB_STAGGER_MS ?? 500);

export function startInternalWorker() {
  if (globalForWorker.workerStarted) {
    console.log("[Worker Loop] Already started, skipping...");
    return;
  }
  globalForWorker.workerStarted = true;

  console.log(
    `[Worker Loop] Starting high-performance concurrent worker (batch=${BATCH_SIZE}, stagger=${JOB_STAGGER_MS}ms)`
  );

  const startedAt = new Date().toISOString();

  // 1. Heartbeat loop
  async function runHeartbeat() {
    try {
      await recordWorkerHeartbeat({
        pid: process.pid,
        hostname: os.hostname(),
        startedAt,
      });
    } catch (error) {
      console.error(
        "[Worker Loop] Heartbeat failed:",
        error instanceof Error ? error.message : error
      );
    }
  }
  void runHeartbeat();
  setInterval(() => void runHeartbeat(), HEARTBEAT_INTERVAL_MS);

  // 2. Reconciliation loop (polling safety net)
  async function runPoll() {
    try {
      await reconcileComments();
    } catch (error) {
      console.error(
        "[Worker Loop] Comment reconciliation failed:",
        error instanceof Error ? error.message : error
      );
    }
  }
  setTimeout(() => void runPoll(), 10_000);
  setInterval(() => void runPoll(), POLL_INTERVAL_MS);

  // 3. Drip Campaign Sequence Runner Loop
  async function runDripScheduler() {
    try {
      await processDueDripEnrollments(25);
    } catch (error) {
      console.error(
        "[Worker Loop] Drip scheduler tick failed:",
        error instanceof Error ? error.message : error
      );
    }
  }
  setTimeout(() => void runDripScheduler(), 5_000);
  setInterval(() => void runDripScheduler(), DRIP_INTERVAL_MS);

  // 4. High-Performance Parallel Batch Processing Loop
  async function processLoop() {
    while (true) {
      try {
        const jobs = await dequeueBatch(BATCH_SIZE);
        if (!jobs || jobs.length === 0) {
          // No pending jobs — wait 500ms before polling again
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }

        console.log(
          `[Worker Loop] Processing batch of ${jobs.length} jobs (stagger: ${JOB_STAGGER_MS}ms)`
        );

        // Process all jobs in the batch concurrently with staggered starts.
        await Promise.allSettled(
          jobs.map(async (job, index) => {
            if (index > 0) {
              await new Promise((resolve) =>
                setTimeout(resolve, index * JOB_STAGGER_MS)
              );
            }
            try {
              await dispatchJob(job.name, job.payload, job.attempts);
              await completeJob(job.id);
            } catch (err) {
              const error = err instanceof Error ? err : new Error(String(err));
              console.error(
                `[Worker Loop] Job ${job.id} (${job.name}) failed:`,
                error.message
              );
              await failJob(job.id, error.message, job.attempts);
              await recordProcessorFailure(
                job.name,
                job.payload,
                job.attempts,
                error
              );
            }
          })
        );
      } catch (loopError) {
        console.error("[Worker Loop] Error in main processing loop:", loopError);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  void processLoop();
}

/**
 * Route a job to its handler by name.
 */
async function dispatchJob(
  name: string,
  payload: any,
  attempts: number
): Promise<void> {
  switch (name) {
    case POSTBACK_JOB_NAME:
      return processPostback(payload, attempts);

    case "process-dm":
    case "process-reaction":
      return processIncomingDirectMessage(payload, attempts);

    case "process-comment":
    default:
      return processComment(payload, attempts);
  }
}

