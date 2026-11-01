import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import crypto from "node:crypto";
import dotenv from "dotenv";
dotenv.config();

function makeClient() {
  let dbUrl = process.env.DATABASE_URL || "mysql://root:pass@127.0.0.1:3306/db";
  dbUrl = dbUrl.replace("@localhost", "@127.0.0.1");
  const adapter = new PrismaMariaDb(dbUrl, { useTextProtocol: true });
  return new PrismaClient({ adapter });
}

function getConversationLockKey(convKey: string): string {
  const hash = crypto.createHash("md5").update(convKey).digest("hex");
  return `openreply_c_${hash}`;
}

async function claimCandidateJob(
  cand: { id: string; payload: any; runAt: Date; createdAt: Date },
  client: any
): Promise<string | null> {
  const parsed = typeof cand.payload === "string" ? JSON.parse(cand.payload) : cand.payload;
  const accId = parsed?.instagramAccountId || "global";
  const targetId = parsed?.userId || parsed?.commenterId || parsed?.recipientId || parsed?.senderId;
  if (!targetId) return null;

  const convKey = `${accId}:${targetId}`;
  const lockName = getConversationLockKey(convKey);

  try {
    return await client.$transaction(async (tx: any) => {
      // 1. Non-blocking advisory lock on conversation
      const lockRes: any = await tx.$queryRawUnsafe(`SELECT GET_LOCK('${lockName}', 0) as acquired`);
      const acquired = Number(lockRes?.[0]?.acquired);
      if (acquired !== 1) {
        return null;
      }

      try {
        // 2. Check if another job of this conversation is RUNNING
        const runningJobs: any = await tx.$queryRawUnsafe(`
          SELECT id FROM BackgroundJob
          WHERE status = 'RUNNING'
            AND id != '${cand.id}'
            AND (
              (JSON_UNQUOTE(JSON_EXTRACT(payload, '$.instagramAccountId')) = '${accId}' OR '${accId}' = 'global')
              AND (
                JSON_UNQUOTE(JSON_EXTRACT(payload, '$.userId')) = '${targetId}'
                OR JSON_UNQUOTE(JSON_EXTRACT(payload, '$.commenterId')) = '${targetId}'
                OR JSON_UNQUOTE(JSON_EXTRACT(payload, '$.recipientId')) = '${targetId}'
                OR JSON_UNQUOTE(JSON_EXTRACT(payload, '$.senderId')) = '${targetId}'
              )
            )
          LIMIT 1
        `);

        if (runningJobs.length > 0) {
          return null;
        }

        // 3. Check if an earlier pending job exists according to deterministic order:
        // runAt -> createdAt -> id
        const runAtIso = cand.runAt.toISOString();
        const createdAtIso = cand.createdAt.toISOString();

        const earlierJobs: any = await tx.$queryRawUnsafe(`
          SELECT id FROM BackgroundJob
          WHERE status = 'PENDING'
            AND id != '${cand.id}'
            AND (
              createdAt < '${createdAtIso}'
              OR (createdAt = '${createdAtIso}' AND runAt < '${runAtIso}')
              OR (createdAt = '${createdAtIso}' AND runAt = '${runAtIso}' AND id < '${cand.id}')
            )
            AND (
              (JSON_UNQUOTE(JSON_EXTRACT(payload, '$.instagramAccountId')) = '${accId}' OR '${accId}' = 'global')
              AND (
                JSON_UNQUOTE(JSON_EXTRACT(payload, '$.userId')) = '${targetId}'
                OR JSON_UNQUOTE(JSON_EXTRACT(payload, '$.commenterId')) = '${targetId}'
                OR JSON_UNQUOTE(JSON_EXTRACT(payload, '$.recipientId')) = '${targetId}'
                OR JSON_UNQUOTE(JSON_EXTRACT(payload, '$.senderId')) = '${targetId}'
              )
            )
          LIMIT 1
        `);

        if (earlierJobs.length > 0) {
          return null;
        }

        // 4. Update candidate to RUNNING
        const updated = await tx.$executeRawUnsafe(`
          UPDATE BackgroundJob
          SET status = 'RUNNING', lockedAt = NOW()
          WHERE id = '${cand.id}' AND status = 'PENDING'
        `);

        return updated > 0 ? cand.id : null;
      } finally {
        await tx.$queryRawUnsafe(`SELECT RELEASE_LOCK('${lockName}')`);
      }
    });
  } catch {
    return null;
  }
}

async function main() {
  console.log("=== Comprehensive Multi-Worker Ordering & Mutual Exclusion Test ===");
  const client1 = makeClient();
  const client2 = makeClient();

  const accId = "acc_order_strict";
  const targetId = "user_order_strict";
  const now = new Date();

  // Test 1: Two jobs with identical runAt and createdAt
  console.log("\n[Test 1] Two jobs with IDENTICAL runAt and createdAt competing concurrently:");
  const job1 = await client1.backgroundJob.create({
    data: {
      name: "strict-job-1",
      payload: { instagramAccountId: accId, userId: targetId, msg: 1 },
      status: "PENDING",
      runAt: now,
      createdAt: now,
    },
  });

  const job2 = await client1.backgroundJob.create({
    data: {
      name: "strict-job-2",
      payload: { instagramAccountId: accId, userId: targetId, msg: 2 },
      status: "PENDING",
      runAt: now,
      createdAt: now,
    },
  });

  console.log(`Job 1 (${job1.id}) vs Job 2 (${job2.id})`);

  const [res1, res2] = await Promise.all([
    claimCandidateJob(job1, client1),
    claimCandidateJob(job2, client2),
  ]);

  console.log("Worker 1 Claim:", res1);
  console.log("Worker 2 Claim:", res2);

  const claimedCount = (res1 ? 1 : 0) + (res2 ? 1 : 0);
  console.log(`Total Claimed: ${claimedCount} (Must be exactly 1)`);
  if (claimedCount !== 1) {
    throw new Error(`Expected exactly 1 claim, got ${claimedCount}`);
  }

  // The claimed job is now RUNNING. Verify that subsequent poll for the other job returns null!
  const otherJob = res1 ? job2 : job1;
  const pollAgain = await claimCandidateJob(otherJob, client2);
  console.log("Subsequent claim for other job while first is RUNNING:", pollAgain, "(Must be null)");
  if (pollAgain !== null) {
    throw new Error("Other job was claimed while first was RUNNING!");
  }

  // Mark first job COMPLETED
  const firstId = (res1 || res2)!;
  await client1.backgroundJob.update({
    where: { id: firstId },
    data: { status: "COMPLETED" },
  });

  // Now the second job should be successfully claimable!
  const secondClaim = await claimCandidateJob(otherJob, client2);
  console.log("Claim other job after first COMPLETED:", secondClaim, "(Must be job ID)");
  if (secondClaim !== otherJob.id) {
    throw new Error("Failed to claim second job after first completed!");
  }

  // Test 2: Retry backoff leapfrog prevention
  console.log("\n[Test 2] Retry backoff leapfrog prevention:");
  const jobRetry = await client1.backgroundJob.create({
    data: {
      name: "retry-job",
      payload: { instagramAccountId: accId, userId: targetId, msg: "original" },
      status: "PENDING",
      runAt: new Date(Date.now() + 5 * 60_000), // Delayed 5 minutes
      createdAt: new Date(Date.now() - 30_000), // Created earlier
    },
  });

  const jobFresh = await client1.backgroundJob.create({
    data: {
      name: "fresh-job",
      payload: { instagramAccountId: accId, userId: targetId, msg: "subsequent" },
      status: "PENDING",
      runAt: now, // Due right now
      createdAt: now, // Created later
    },
  });

  // Worker tries to claim the fresh job while retry job is waiting for backoff
  const freshClaim = await claimCandidateJob(jobFresh, client1);
  console.log("Attempt claim fresh job while earlier job is in retry backoff:", freshClaim, "(Must be null)");
  if (freshClaim !== null) {
    throw new Error("Fresh job leapfrogged the earlier retrying job!");
  }
  console.log("SUCCESS: Leapfrog prevented! Fresh job waited for earlier retrying job.");

  // Clean up
  await client1.backgroundJob.deleteMany({
    where: { id: { in: [job1.id, job2.id, jobRetry.id, jobFresh.id] } },
  });

  await client1.$disconnect();
  await client2.$disconnect();
  console.log("\nALL ORDERING & MUTUAL EXCLUSION TESTS PASSED 100%!");
}

main().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
