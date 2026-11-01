import { describe, it, expect, vi, beforeEach } from "vitest";
import { dequeueBatch, completeJob, failJob, getConversationKey } from "@/lib/queue/mysql-queue";
import { reserveDMSlot, checkRateLimit, resetRateLimit } from "@/lib/utils/rate-limiter";

// Mock Prisma client for unit simulation
vi.mock("@/lib/db/client", () => {
  const mockBackgroundJob = {
    findMany: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  };
  const mockDmLog = {
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  };
  return {
    prisma: {
      backgroundJob: mockBackgroundJob,
      dmLog: mockDmLog,
      $disconnect: vi.fn().mockResolvedValue(undefined),
    },
  };
});

describe("Multi-Worker Safety & Concurrency Suite", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { prisma } = await import("@/lib/db/client");
    vi.mocked(prisma.backgroundJob.updateMany).mockResolvedValue({ count: 1 });
  });

  describe("1. Multi-Worker Conversation Mutual Exclusion", () => {
    it("should prevent Worker 2 from claiming Job 2 while Job 1 of the same conversation is RUNNING in Worker 1", async () => {
      const { prisma } = await import("@/lib/db/client");

      const job1Payload = { instagramAccountId: "acc_main", userId: "user_vip_1", text: "First message" };
      const job2Payload = { instagramAccountId: "acc_main", userId: "user_vip_1", text: "Second message" };

      // Worker 1 dequeues when NO jobs are running yet
      vi.mocked(prisma.backgroundJob.findMany)
        .mockResolvedValueOnce([]) // active running jobs: none
        .mockResolvedValueOnce([
          { id: "job-1", payload: job1Payload },
          { id: "job-2", payload: job2Payload },
        ] as any) // candidates
        .mockResolvedValueOnce([
          { id: "job-1", name: "process-dm", payload: job1Payload, attempts: 0 },
        ] as any); // Worker 1 claimed jobs

      vi.mocked(prisma.backgroundJob.updateMany).mockResolvedValueOnce({ count: 1 }); // Worker 1 claims job-1

      const worker1Jobs = await dequeueBatch(10);
      expect(worker1Jobs.length).toBe(1);
      expect(worker1Jobs[0].id).toBe("job-1");

      // NOW: While Worker 1 is still processing Job 1 (Job 1 is RUNNING in DB):
      // Worker 2 attempts to dequeue.
      vi.mocked(prisma.backgroundJob.findMany)
        .mockResolvedValueOnce([
          { payload: job1Payload }, // active running jobs in DB: Job 1 is RUNNING!
        ] as any)
        .mockResolvedValueOnce([
          { id: "job-2", payload: job2Payload }, // Candidate: Job 2 for user_vip_1
        ] as any);

      // Worker 2 should detect that user_vip_1 has an active RUNNING job, and SKIP job-2!
      const worker2Jobs = await dequeueBatch(10);
      expect(worker2Jobs.length).toBe(0);
      // Worker 2 was 100% blocked from executing Job 2 concurrently!

      // Once Worker 1 finishes Job 1:
      await completeJob("job-1");

      // Next poll when Job 1 is no longer RUNNING:
      vi.mocked(prisma.backgroundJob.findMany)
        .mockResolvedValueOnce([]) // active running jobs: none!
        .mockResolvedValueOnce([
          { id: "job-2", payload: job2Payload }, // Candidate: Job 2
        ] as any)
        .mockResolvedValueOnce([
          { id: "job-2", name: "process-dm", payload: job2Payload, attempts: 0 },
        ] as any);

      vi.mocked(prisma.backgroundJob.updateMany).mockResolvedValueOnce({ count: 1 }); // Now job-2 can be claimed

      const worker2NextPollJobs = await dequeueBatch(10);
      expect(worker2NextPollJobs.length).toBe(1);
      expect(worker2NextPollJobs[0].id).toBe("job-2");
    });

    it("should allow independent conversations to be claimed concurrently by different workers", async () => {
      const { prisma } = await import("@/lib/db/client");

      const user1Payload = { instagramAccountId: "acc_main", userId: "user_alpha" };
      const user2Payload = { instagramAccountId: "acc_main", userId: "user_beta" };

      // Worker 1 is running user_alpha's job
      // Worker 2 polls and finds user_beta's job
      vi.mocked(prisma.backgroundJob.findMany)
        .mockResolvedValueOnce([
          { payload: user1Payload }, // user_alpha is RUNNING
        ] as any)
        .mockResolvedValueOnce([
          { id: "job-beta", payload: user2Payload }, // user_beta is PENDING
        ] as any)
        .mockResolvedValueOnce([
          { id: "job-beta", name: "process-dm", payload: user2Payload, attempts: 0 },
        ] as any);

      vi.mocked(prisma.backgroundJob.updateMany).mockResolvedValueOnce({ count: 1 });

      const worker2Jobs = await dequeueBatch(10);
      // Independent user_beta is NOT blocked by user_alpha!
      expect(worker2Jobs.length).toBe(1);
      expect(worker2Jobs[0].id).toBe("job-beta");
    });

    it("should ensure retry backoff preserves FIFO ordering and prevents subsequent jobs from leapfrogging", async () => {
      const { prisma } = await import("@/lib/db/client");

      const convPayload = { instagramAccountId: "acc_main", userId: "user_retry_seq" };

      // Job 1 failed and was delayed by failJob
      await failJob("job-failed-1", "Meta API temporary 500", 0, true);

      // Verify that failJob rescheduled job-failed-1 with backoff
      expect(prisma.backgroundJob.updateMany).toHaveBeenCalledWith({
        where: { id: "job-failed-1", status: "RUNNING" },
        data: expect.objectContaining({
          status: "PENDING",
          error: "Meta API temporary 500",
          attempts: { increment: 1 },
        }),
      });

      // When dequeueBatch runs, if job-1 is RUNNING or active, Job 2 for the same user is skipped
      vi.mocked(prisma.backgroundJob.findMany)
        .mockResolvedValueOnce([
          { payload: convPayload }, // Job 1 is RUNNING
        ] as any)
        .mockResolvedValueOnce([
          { id: "job-fresh-2", payload: convPayload },
        ] as any);

      const jobs = await dequeueBatch(10);
      expect(jobs.length).toBe(0); // Job 2 is not dispatched before Job 1 finishes
    });

    it("should handle permanent failure by moving poison pills to FAILED after max attempts", async () => {
      const { prisma } = await import("@/lib/db/client");

      // Attempt 3 failure -> should permanently fail
      await failJob("job-poison", "Permanent error", 3, true);

      expect(prisma.backgroundJob.updateMany).toHaveBeenCalledWith({
        where: { id: "job-poison", status: "RUNNING" },
        data: expect.objectContaining({
          status: "FAILED",
          error: "Permanent error",
        }),
      });
    });
  });

  describe("2. Concurrent Rate Limiting & Mutex Protection", () => {
    it("should strictly block concurrent requests when approaching cap (no race over-allocation)", async () => {
      const { prisma } = await import("@/lib/db/client");
      const accountId = "ig_acc_concurrency_test";

      // Reset cache for this account
      await resetRateLimit(accountId);

      // Current DB state: 179 DMs sent in last hour (cap is 180, only 1 slot remaining!)
      vi.mocked(prisma.dmLog.count).mockResolvedValue(179);

      // Simulate 5 simultaneous requests calling reserveDMSlot at the exact same millisecond
      const results = await Promise.all([
        reserveDMSlot(accountId, "COMMENT_REPLY", 0),
        reserveDMSlot(accountId, "COMMENT_REPLY", 0),
        reserveDMSlot(accountId, "COMMENT_REPLY", 0),
        reserveDMSlot(accountId, "COMMENT_REPLY", 0),
        reserveDMSlot(accountId, "COMMENT_REPLY", 0),
      ]);

      const allowedCount = results.filter((r) => r.allowed).length;
      const blockedCount = results.filter((r) => !r.allowed).length;

      // Exactly ONE request should be allowed (taking slot 180), and the other 4 MUST be blocked!
      expect(allowedCount).toBe(1);
      expect(blockedCount).toBe(4);
    });

    it("should count in-flight PENDING reservations created within the last 2 minutes across processes", async () => {
      const { prisma } = await import("@/lib/db/client");
      const accountId = "ig_acc_inflight_test";

      await resetRateLimit(accountId);

      // When querying the DB, verify that the OR clause checks both SENT in last hour AND PENDING in last 2 minutes
      vi.mocked(prisma.dmLog.count).mockResolvedValueOnce(50);

      await checkRateLimit(accountId, "COMMENT_REPLY", 0);

      expect(prisma.dmLog.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          instagramAccountId: accountId,
          type: "COMMENT_REPLY",
          OR: expect.arrayContaining([
            expect.objectContaining({ status: "SENT" }),
            expect.objectContaining({ status: "PENDING" }),
          ]),
        }),
      });
    });
  });
});
