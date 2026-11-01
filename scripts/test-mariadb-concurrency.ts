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

async function main() {
  console.log("--- Testing Two Independent Connections Competing for Same Conversation Lock ---");

  const client1 = makeClient();
  const client2 = makeClient();

  const lockKey = "openreply_conv_acc_main_user_vip";

  // Worker 1 acquires the lock
  const res1: any = await client1.$queryRawUnsafe(`SELECT GET_LOCK('${lockKey}', 0) as acquired`);
  const acquired1 = Number(res1[0]?.acquired);
  console.log("Worker 1 Acquire Result:", acquired1); // Expected: 1

  // Worker 2 tries to acquire the EXACT SAME conversation lock concurrently
  const res2: any = await client2.$queryRawUnsafe(`SELECT GET_LOCK('${lockKey}', 0) as acquired`);
  const acquired2 = Number(res2[0]?.acquired);
  console.log("Worker 2 Acquire Result:", acquired2); // MUST BE 0 (blocked!)

  // Worker 1 releases the lock
  const rel1: any = await client1.$queryRawUnsafe(`SELECT RELEASE_LOCK('${lockKey}') as released`);
  console.log("Worker 1 Released:", Number(rel1[0]?.released));

  // Now Worker 2 tries again after release:
  const res3: any = await client2.$queryRawUnsafe(`SELECT GET_LOCK('${lockKey}', 0) as acquired`);
  const acquired3 = Number(res3[0]?.acquired);
  console.log("Worker 2 Acquire After Release:", acquired3); // Expected: 1

  // Clean up
  await client2.$queryRawUnsafe(`SELECT RELEASE_LOCK('${lockKey}') as released`);

  await client1.$disconnect();
  await client2.$disconnect();
}

main().catch(console.error);
