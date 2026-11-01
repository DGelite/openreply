import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { reserveDMSlot, releaseDMReservation } from "../lib/utils/rate-limiter";
import dotenv from "dotenv";
dotenv.config();

function makeClient() {
  let dbUrl = process.env.DATABASE_URL || "mysql://root:pass@127.0.0.1:3306/db";
  dbUrl = dbUrl.replace("@localhost", "@127.0.0.1");
  const adapter = new PrismaMariaDb(dbUrl, { useTextProtocol: true });
  return new PrismaClient({ adapter });
}

async function runRateLimitConcurrencyTest() {
  console.log("=== Testing Production reserveDMSlot with Dual MariaDB Clients ===");
  const client1 = makeClient();
  const client2 = makeClient();

  const testAccountId = "acc_dual_client_rate_test";
  const flagKey = `RATE_INFLIGHT:${testAccountId}:COMMENT_REPLY`;

  try {
    // 1. Clean previous state
    await client1.systemFeatureFlag.deleteMany({
      where: { featureKey: flagKey },
    });
    await client1.dmLog.deleteMany({
      where: { instagramAccountId: testAccountId },
    });

    // 2. Set in-flight count to 179 (limit for COMMENT_REPLY is 180)
    await client1.systemFeatureFlag.create({
      data: {
        workspaceId: "global",
        featureKey: flagKey,
        config: { inFlight: 179, updatedAt: Date.now() },
      },
    });

    console.log("Initial state: 179/180 slots occupied. Firing two simultaneous reserveDMSlot calls...");

    // 3. Race two distinct clients calling production reserveDMSlot
    const [res1, res2] = await Promise.all([
      reserveDMSlot(testAccountId, "COMMENT_REPLY", 0, client1),
      reserveDMSlot(testAccountId, "COMMENT_REPLY", 0, client2),
    ]);

    console.log("Client 1 result:", { allowed: res1.allowed, currentCount: res1.currentCount, remainingDMs: res1.remainingDMs });
    console.log("Client 2 result:", { allowed: res2.allowed, currentCount: res2.currentCount, remainingDMs: res2.remainingDMs });

    const allowedCount = (res1.allowed ? 1 : 0) + (res2.allowed ? 1 : 0);
    console.log(`Allowed count: ${allowedCount} (Must be exactly 1)`);
    if (allowedCount !== 1) {
      throw new Error(`Rate limit breached! Expected 1 allowed, got ${allowedCount}`);
    }

    // 4. Verify Atomic Reservation: DB state must show inFlight = 180
    const finalFlag = await client1.systemFeatureFlag.findUnique({
      where: { workspaceId_featureKey: { workspaceId: "global", featureKey: flagKey } },
    });
    const finalInFlight = (finalFlag?.config as any)?.inFlight;
    console.log(`DB inFlight after reservation: ${finalInFlight} (Must be 180)`);
    if (finalInFlight !== 180) {
      throw new Error(`Atomic reservation failed to persist in DB! Expected 180, got ${finalInFlight}`);
    }

    // 5. Test capacity release via releaseDMReservation (e.g. dispatch timeout or network failure)
    console.log("\nTesting releaseDMReservation on dispatch failure...");
    await releaseDMReservation(testAccountId, "COMMENT_REPLY", client1);

    const releasedFlag = await client1.systemFeatureFlag.findUnique({
      where: { workspaceId_featureKey: { workspaceId: "global", featureKey: flagKey } },
    });
    const releasedInFlight = (releasedFlag?.config as any)?.inFlight;
    console.log(`DB inFlight after release: ${releasedInFlight} (Must be 179)`);
    if (releasedInFlight !== 179) {
      throw new Error(`releaseDMReservation failed to decrement! Expected 179, got ${releasedInFlight}`);
    }

    // Now a new reservation should succeed again!
    const resRetry = await reserveDMSlot(testAccountId, "COMMENT_REPLY", 0, client2);
    console.log("Retry reservation after release:", { allowed: resRetry.allowed, currentCount: resRetry.currentCount });
    if (!resRetry.allowed) {
      throw new Error("Reservation failed to acquire newly freed slot!");
    }

    // 6. Test automatic expiration of in-flight reservations (> 120s)
    console.log("\nTesting auto-expiration of stale in-flight reservations (> 120s)...");
    await client1.systemFeatureFlag.update({
      where: { workspaceId_featureKey: { workspaceId: "global", featureKey: flagKey } },
      data: {
        config: { inFlight: 180, updatedAt: Date.now() - 125_000 }, // Expired 125s ago
      },
    });

    const resExpired = await reserveDMSlot(testAccountId, "COMMENT_REPLY", 0, client1);
    console.log("Reservation with expired in-flight entries:", { allowed: resExpired.allowed, currentCount: resExpired.currentCount });
    if (!resExpired.allowed) {
      throw new Error("Expired in-flight reservation blocked new request!");
    }

    console.log("\nALL MULTI-PROCESS RATE LIMITER CONCURRENCY TESTS PASSED 100%!");
  } finally {
    // Cleanup
    await client1.systemFeatureFlag.deleteMany({
      where: { featureKey: flagKey },
    }).catch(() => {});
    await client1.$disconnect();
    await client2.$disconnect();
  }
}

runRateLimitConcurrencyTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
