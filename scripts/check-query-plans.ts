import { prisma } from "../lib/db/client";

async function checkPlans() {
  console.log("--- 1. BackgroundJob Dequeue Query Plan ---");
  const jobPlan = await prisma.$queryRawUnsafe(
    "EXPLAIN SELECT id FROM BackgroundJob WHERE status = 'PENDING' AND runAt <= NOW() ORDER BY runAt ASC LIMIT 15;"
  );
  const serialize = (data: any) => JSON.stringify(data, (k, v) => typeof v === "bigint" ? v.toString() : v, 2);

  console.log(serialize(jobPlan));

  console.log("\n--- 2. DripEnrollment Worker Scan Query Plan ---");
  const dripPlan = await prisma.$queryRawUnsafe(
    "EXPLAIN SELECT id FROM DripEnrollment WHERE status = 'ACTIVE' AND nextRunAt <= NOW() LIMIT 25;"
  );
  console.log(serialize(dripPlan));

  console.log("\n--- 3. ConversationState Lookup Plan ---");
  const convPlan = await prisma.$queryRawUnsafe(
    "EXPLAIN SELECT * FROM ConversationState WHERE instagramAccountId = 'test_acc' AND userId = 'test_user';"
  );
  console.log(serialize(convPlan));

  console.log("\n--- 4. DmLog Rate Limit Count Plan ---");
  const logPlan = await prisma.$queryRawUnsafe(
    "EXPLAIN SELECT COUNT(*) FROM DmLog WHERE instagramAccountId = 'test_acc' AND type = 'DIRECT_MESSAGE' AND status = 'SENT' AND dmSentAt >= NOW() - INTERVAL 1 HOUR;"
  );
  console.log(serialize(logPlan));

  await prisma.$disconnect();
}

checkPlans().catch((err) => {
  console.error(err);
  process.exit(1);
});
