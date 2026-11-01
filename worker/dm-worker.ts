import dotenv from "dotenv";
dotenv.config();

import { startInternalWorker } from "../lib/queue/worker-loop";
import { prisma } from "../lib/db/client";

console.log("==================================================");
console.log("🚀 OpenReply Standalone Background Worker Starting");
console.log(`   PID: ${process.pid}`);
console.log(`   Node: ${process.version}`);
console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);
console.log("==================================================");

// Graceful shutdown handling for VPS process managers (PM2 / systemd / Docker)
const shutdown = async (signal: string) => {
  console.log(`\n[Worker] Received ${signal}. Shutting down gracefully...`);
  try {
    await prisma.$disconnect();
    console.log("[Worker] Database disconnected cleanly.");
  } catch (err) {
    console.error("[Worker] Error during database disconnect:", err);
  }
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

// Start the high-performance worker processing loop
startInternalWorker();
