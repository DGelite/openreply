import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import dotenv from "dotenv";
dotenv.config();

function makeClient() {
  let dbUrl = process.env.DATABASE_URL || "mysql://root:pass@127.0.0.1:3306/db";
  dbUrl = dbUrl.replace("@localhost", "@127.0.0.1");
  const adapter = new PrismaMariaDb(dbUrl, { useTextProtocol: true });
  return new PrismaClient({ adapter });
}

async function test() {
  console.log("=== Testing Two Jobs of Same Conversation with IDENTICAL createdAt ===");
  const client1 = makeClient();
  const client2 = makeClient();

  const accId = "acc_order_test";
  const targetId = "user_same_created_at";
  const now = new Date();

  // Create two jobs with identical runAt and createdAt
  const job1 = await client1.backgroundJob.create({
    data: {
      name: "order-test-job-1",
      payload: { instagramAccountId: accId, userId: targetId, msg: 1 },
      status: "PENDING",
      runAt: now,
      createdAt: now,
    },
  });

  const job2 = await client1.backgroundJob.create({
    data: {
      name: "order-test-job-2",
      payload: { instagramAccountId: accId, userId: targetId, msg: 2 },
      status: "PENDING",
      runAt: now,
      createdAt: now,
    },
  });

  console.log(`Created Job 1 (${job1.id}, createdAt=${job1.createdAt.toISOString()})`);
  console.log(`Created Job 2 (${job2.id}, createdAt=${job2.createdAt.toISOString()})`);

  // Candidate 1 = job1, Candidate 2 = job2
  // Let's test current SQL query on Job 1 and Job 2 simultaneously:
  const createdAtIso1 = job1.createdAt.toISOString();
  const createdAtIso2 = job2.createdAt.toISOString();

  // Worker 1 and Worker 2 try to claim at the exact same moment:
  const [claim1, claim2] = await Promise.all([
    client1.$executeRaw`
      UPDATE BackgroundJob
      SET status = 'RUNNING', lockedAt = NOW()
      WHERE id = ${job1.id} AND status = 'PENDING'
        AND NOT EXISTS (
          SELECT 1 FROM (
            SELECT payload FROM BackgroundJob
            WHERE status = 'RUNNING'
              AND id != ${job1.id}
          ) AS running_jobs
          WHERE (
            (JSON_UNQUOTE(JSON_EXTRACT(payload, '$.instagramAccountId')) = ${accId} OR ${accId} = 'global')
            AND (
              JSON_UNQUOTE(JSON_EXTRACT(payload, '$.userId')) = ${targetId}
              OR JSON_UNQUOTE(JSON_EXTRACT(payload, '$.commenterId')) = ${targetId}
              OR JSON_UNQUOTE(JSON_EXTRACT(payload, '$.recipientId')) = ${targetId}
              OR JSON_UNQUOTE(JSON_EXTRACT(payload, '$.senderId')) = ${targetId}
            )
          )
        )
        AND NOT EXISTS (
          SELECT 1 FROM (
            SELECT payload, createdAt FROM BackgroundJob
            WHERE status = 'PENDING'
              AND id != ${job1.id}
              AND createdAt < ${createdAtIso1}
          ) AS earlier_pending_jobs
          WHERE (
            (JSON_UNQUOTE(JSON_EXTRACT(payload, '$.instagramAccountId')) = ${accId} OR ${accId} = 'global')
            AND (
              JSON_UNQUOTE(JSON_EXTRACT(payload, '$.userId')) = ${targetId}
              OR JSON_UNQUOTE(JSON_EXTRACT(payload, '$.commenterId')) = ${targetId}
              OR JSON_UNQUOTE(JSON_EXTRACT(payload, '$.recipientId')) = ${targetId}
              OR JSON_UNQUOTE(JSON_EXTRACT(payload, '$.senderId')) = ${targetId}
            )
          )
        )
    `,
    client2.$executeRaw`
      UPDATE BackgroundJob
      SET status = 'RUNNING', lockedAt = NOW()
      WHERE id = ${job2.id} AND status = 'PENDING'
        AND NOT EXISTS (
          SELECT 1 FROM (
            SELECT payload FROM BackgroundJob
            WHERE status = 'RUNNING'
              AND id != ${job2.id}
          ) AS running_jobs
          WHERE (
            (JSON_UNQUOTE(JSON_EXTRACT(payload, '$.instagramAccountId')) = ${accId} OR ${accId} = 'global')
            AND (
              JSON_UNQUOTE(JSON_EXTRACT(payload, '$.userId')) = ${targetId}
              OR JSON_UNQUOTE(JSON_EXTRACT(payload, '$.commenterId')) = ${targetId}
              OR JSON_UNQUOTE(JSON_EXTRACT(payload, '$.recipientId')) = ${targetId}
              OR JSON_UNQUOTE(JSON_EXTRACT(payload, '$.senderId')) = ${targetId}
            )
          )
        )
        AND NOT EXISTS (
          SELECT 1 FROM (
            SELECT payload, createdAt FROM BackgroundJob
            WHERE status = 'PENDING'
              AND id != ${job2.id}
              AND createdAt < ${createdAtIso2}
          ) AS earlier_pending_jobs
          WHERE (
            (JSON_UNQUOTE(JSON_EXTRACT(payload, '$.instagramAccountId')) = ${accId} OR ${accId} = 'global')
            AND (
              JSON_UNQUOTE(JSON_EXTRACT(payload, '$.userId')) = ${targetId}
              OR JSON_UNQUOTE(JSON_EXTRACT(payload, '$.commenterId')) = ${targetId}
              OR JSON_UNQUOTE(JSON_EXTRACT(payload, '$.recipientId')) = ${targetId}
              OR JSON_UNQUOTE(JSON_EXTRACT(payload, '$.senderId')) = ${targetId}
            )
          )
        )
    `,
  ]);

  console.log("Worker 1 Claim Result:", Number(claim1));
  console.log("Worker 2 Claim Result:", Number(claim2));

  const totalClaimed = Number(claim1) + Number(claim2);
  console.log(`Total Claimed: ${totalClaimed} (Must be 1, NEVER 2!)`);

  if (totalClaimed > 1) {
    console.error("VULNERABILITY CONFIRMED: Both jobs with identical createdAt were claimed simultaneously!");
  } else {
    console.log("SUCCESS: Only one job was claimed.");
  }

  // Clean up
  await client1.backgroundJob.deleteMany({
    where: { id: { in: [job1.id, job2.id] } },
  });

  await client1.$disconnect();
  await client2.$disconnect();
}

test().catch(console.error);
