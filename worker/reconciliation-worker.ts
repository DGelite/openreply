import dotenv from "dotenv";
dotenv.config();

import { reconcileAllActiveAutomations } from "../lib/reconciliation/reconciliation-engine";
import { prisma } from "../lib/db/client";

console.log("==================================================");
console.log("🛡️ OpenReply Zero-Lead-Loss Reconciliation Worker");
console.log(`   PID: ${process.pid}`);
console.log(`   Node: ${process.version}`);
console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);
console.log("==================================================");

const INTERVAL_MS = Number(process.env.RECONCILIATION_INTERVAL_MS) || 5 * 60 * 1000; // 5 minutes

let isRunning = false;

async function runCycle() {
  if (isRunning) {
    console.log("[Reconciliation Worker] Previous cycle still running, skipping.");
    return;
  }
  isRunning = true;
  const start = Date.now();
  console.log(`[Reconciliation Worker] Starting audit cycle at ${new Date().toISOString()}...`);

  try {
    const report = await reconcileAllActiveAutomations();
    const elapsed = Date.now() - start;
    console.log(
      `[Reconciliation Worker] Cycle finished in ${elapsed}ms. Scanned ${report.scannedPosts} posts, ` +
      `${report.totalCommentsScanned} comments. Recovered: ${report.totalLeadsRecovered} leads.`
    );
  } catch (error) {
    console.error("[Reconciliation Worker] Error during cycle:", error);
  } finally {
    isRunning = false;
  }
}

// Initial immediate run
void runCycle();

// Recurring interval
const intervalId = setInterval(() => {
  void runCycle();
}, INTERVAL_MS);

// Graceful shutdown handling
const shutdown = async (signal: string) => {
  console.log(`\n[Reconciliation Worker] Received ${signal}. Shutting down cleanly...`);
  clearInterval(intervalId);
  try {
    await prisma.$disconnect();
  } catch {}
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
