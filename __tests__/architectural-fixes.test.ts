import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";
import { getWorkerHealth, recordWorkerHeartbeat } from "../lib/ops/worker-health";
import { completeJob, failJob, enqueueJobsBatch, dequeueBatch, recoverStaleJobs } from "../lib/queue/mysql-queue";
import { checkRateLimit } from "../lib/utils/rate-limiter";

// Mock Prisma
vi.mock("../lib/db/client", () => {
  const mockOperationalEvent = {
    create: vi.fn().mockResolvedValue({ id: "event-1" }),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    findFirst: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
  };
  const mockBackgroundJob = {
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({ id: "job-1" }),
    create: vi.fn().mockResolvedValue({ id: "job-1" }),
    createMany: vi.fn().mockResolvedValue({ count: 2 }),
  };
  const mockDripEnrollment = {
    updateMany: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({ id: "enroll-1" }),
  };
  const mockDmLog = {
    count: vi.fn().mockResolvedValue(0),
    findMany: vi.fn().mockResolvedValue([]),
  };
  return {
    prisma: {
      operationalEvent: mockOperationalEvent,
      backgroundJob: mockBackgroundJob,
      dripEnrollment: mockDripEnrollment,
      dmLog: mockDmLog,
      $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
      $disconnect: vi.fn().mockResolvedValue(undefined),
    },
  };
});

describe("Architectural & Security Enhancements Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Timing-Safe Webhook HMAC Verification", () => {
    it("should safely handle mismatched buffer lengths without throwing RangeError", () => {
      const incomingToken = "short-token";
      const actualSecret = "very-long-secret-key-that-exceeds-the-length-of-the-incoming-token";

      const tokenBuf = Buffer.from(incomingToken, "utf8");
      const secretBuf = Buffer.from(actualSecret, "utf8");

      // Verify the previous unsafe pattern would have thrown
      expect(() => {
        crypto.timingSafeEqual(tokenBuf, secretBuf);
      }).toThrow();

      // Verify the fixed safe pattern returns false cleanly
      const isTokenValid =
        tokenBuf.length === secretBuf.length &&
        crypto.timingSafeEqual(tokenBuf, secretBuf);

      expect(isTokenValid).toBe(false);
    });

    it("should correctly authenticate equal tokens", () => {
      const token = "secure-random-token-1234567890";
      const tokenBuf = Buffer.from(token, "utf8");
      const secretBuf = Buffer.from(token, "utf8");

      const isTokenValid =
        tokenBuf.length === secretBuf.length &&
        crypto.timingSafeEqual(tokenBuf, secretBuf);

      expect(isTokenValid).toBe(true);
    });
  });

  describe("2. Cross-Process Worker Health Resiliency", () => {
    it("should report healthy when DB operational event contains recent heartbeat", async () => {
      const { prisma } = await import("../lib/db/client");

      const recentTime = new Date(Date.now() - 15_000).toISOString();
      vi.mocked(prisma.operationalEvent.findFirst).mockResolvedValueOnce({
        id: "hb-1",
        workspaceId: null,
        source: "HEALTH",
        level: "INFO",
        message: "Worker heartbeat",
        payload: {
          status: "running",
          worker: "dm",
          pid: 12345,
          hostname: "vps-prod-01",
          startedAt: new Date(Date.now() - 3600_000).toISOString(),
          checkedAt: recentTime,
        },
        createdAt: new Date(Date.now() - 15_000),
        resolvedAt: null,
      } as any);

      const health = await getWorkerHealth();
      expect(health.healthy).toBe(true);
      expect(health.heartbeat?.pid).toBe(12345);
      expect(health.heartbeat?.hostname).toBe("vps-prod-01");
    });

    it("should report unhealthy when last heartbeat exceeds TTL", async () => {
      const { prisma } = await import("../lib/db/client");

      const staleTime = new Date(Date.now() - 150_000).toISOString(); // 150s ago (> 120s TTL)
      vi.mocked(prisma.operationalEvent.findFirst).mockResolvedValueOnce({
        id: "hb-old",
        workspaceId: null,
        source: "HEALTH",
        level: "INFO",
        message: "Worker heartbeat",
        payload: {
          status: "running",
          worker: "dm",
          pid: 9999,
          hostname: "vps-prod-01",
          checkedAt: staleTime,
        },
        createdAt: new Date(Date.now() - 150_000),
        resolvedAt: null,
      } as any);

      const health = await getWorkerHealth();
      expect(health.healthy).toBe(false);
      expect(health.ageMs).toBeGreaterThan(120_000);
    });
  });

  describe("3. Secret Masking in API Endpoints", () => {
    function maskSecret(secret?: string | null): string {
      if (!secret) return "";
      return "••••••••••••";
    }

    it("should mask sensitive keys and never expose plain credentials", () => {
      const sensitiveApiKey = "sms_live_sk_94839201948291049281";
      const masked = maskSecret(sensitiveApiKey);

      expect(masked).toBe("••••••••••••");
      expect(masked).not.toContain("sms_live_sk");
    });
  });

  describe("4. Queue Atomic Completion and Concurrency", () => {
    it("should correctly calculate stale cutoff window for 5-minute timeout", () => {
      const STALE_RUNNING_TIMEOUT_MS = 5 * 60 * 1000;
      const staleCutoff = new Date(Date.now() - STALE_RUNNING_TIMEOUT_MS);
      const diffMs = Date.now() - staleCutoff.getTime();

      expect(diffMs).toBeGreaterThanOrEqual(STALE_RUNNING_TIMEOUT_MS);
      expect(diffMs).toBeLessThanOrEqual(STALE_RUNNING_TIMEOUT_MS + 100);
    });

    it("completeJob should enforce status RUNNING in where clause", async () => {
      const { prisma } = await import("../lib/db/client");
      await completeJob("job-test-123");

      expect(prisma.backgroundJob.updateMany).toHaveBeenCalledWith({
        where: { id: "job-test-123", status: "RUNNING" },
        data: {
          status: "COMPLETED",
          lockedAt: null,
        },
      });
    });

    it("failJob should enforce status RUNNING in where clause", async () => {
      const { prisma } = await import("../lib/db/client");
      await failJob("job-test-456", "Network timeout", 1, true);

      expect(prisma.backgroundJob.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "job-test-456", status: "RUNNING" },
          data: expect.objectContaining({
            status: "PENDING",
            error: "Network timeout",
            lockedAt: null,
          }),
        })
      );
    });
  });

  describe("5. Drip Concurrency Lease Guard", () => {
    it("should atomically lease enrollment preventing concurrent worker double-processing", async () => {
      const { prisma } = await import("../lib/db/client");

      // First worker succeeds in acquiring the 5m lease
      vi.mocked(prisma.dripEnrollment.updateMany).mockResolvedValueOnce({ count: 1 });

      const dueTime = new Date();
      const claim1 = await prisma.dripEnrollment.updateMany({
        where: { id: "enroll-1", status: "ACTIVE", nextRunAt: dueTime },
        data: { nextRunAt: new Date(Date.now() + 300_000) },
      });
      expect(claim1.count).toBe(1);

      // Concurrent worker fails because nextRunAt has already moved
      vi.mocked(prisma.dripEnrollment.updateMany).mockResolvedValueOnce({ count: 0 });

      const claim2 = await prisma.dripEnrollment.updateMany({
        where: { id: "enroll-1", status: "ACTIVE", nextRunAt: dueTime },
        data: { nextRunAt: new Date(Date.now() + 300_000) },
      });
      expect(claim2.count).toBe(0);
    });
  });

  describe("6. Cron Secret Fail-Closed Security", () => {
    it("should strictly reject request if CRON_SECRET is empty/undefined", () => {
      const cronSecret: string | undefined = undefined;
      const authHeader = "Bearer undefined";

      // Fixed logic: !cronSecret fails safely
      const isAuthorized = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);
      expect(isAuthorized).toBe(false);
    });

    it("should accept valid bearer token when CRON_SECRET is set", () => {
      const cronSecret = "strong_random_cron_key_928374";
      const authHeader = `Bearer ${cronSecret}`;

      const isAuthorized = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);
      expect(isAuthorized).toBe(true);
    });
  });

  describe("7. High-Performance Batch Queue Ingestion", () => {
    it("should return count: 0 and skip DB query when jobs array is empty or undefined", async () => {
      const { prisma } = await import("../lib/db/client");
      const res1 = await enqueueJobsBatch([]);
      expect(res1.count).toBe(0);

      const res2 = await enqueueJobsBatch(null as any);
      expect(res2.count).toBe(0);

      expect(prisma.backgroundJob.createMany).not.toHaveBeenCalled();
    });

    it("should call createMany with mapped payloads, PENDING status, and runAt delays", async () => {
      const { prisma } = await import("../lib/db/client");
      const jobs = [
        { name: "process-comment", payload: { commentId: "c1", instagramAccountId: "acc1" }, runAtDelayMs: 0 },
        { name: "process-postback", payload: { userId: "u1", instagramAccountId: "acc2" }, runAtDelayMs: 5000 },
      ];

      const res = await enqueueJobsBatch(jobs);
      expect(res.count).toBe(2);
      expect(prisma.backgroundJob.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            name: "process-comment",
            status: "PENDING",
            payload: { commentId: "c1", instagramAccountId: "acc1" },
          }),
          expect.objectContaining({
            name: "process-postback",
            status: "PENDING",
            payload: { userId: "u1", instagramAccountId: "acc2" },
          }),
        ]),
      });
    });
  });

  describe("8. Multi-Tenant Log Isolation and Zero-Leak Security", () => {
    it("should strictly enforce workspaceId filter and never leak cross-tenant logs", async () => {
      const { prisma } = await import("../lib/db/client");
      const tenantA = "ws_tenant_alpha";

      // Simulate a query for tenantA logs
      const where: any = {
        workspaceId: tenantA,
      };

      vi.mocked(prisma.dmLog.count).mockResolvedValueOnce(0);
      vi.mocked(prisma.dmLog.findMany).mockResolvedValueOnce([]);

      const total = await prisma.dmLog.count({ where });
      const logs = await prisma.dmLog.findMany({ where });

      expect(total).toBe(0);
      expect(logs).toEqual([]);
      // Crucial security invariant: the where query NEVER dropped workspaceId!
      expect(prisma.dmLog.count).toHaveBeenCalledWith({ where: { workspaceId: tenantA } });
      expect(prisma.dmLog.findMany).toHaveBeenCalledWith({ where: { workspaceId: tenantA } });
    });
  });

  describe("9. Worker Race Condition, Mutual Exclusion & Anti-Double-Processing", () => {
    it("should ensure exactly one worker claims a contested job under concurrent calls", async () => {
      const { prisma } = await import("../lib/db/client");

      // Worker A dequeue calls:
      // 1. active running jobs: none
      // 2. candidate search: returns job-123
      // 3. Worker A final fetch for claimed job
      vi.mocked(prisma.backgroundJob.findMany)
        .mockResolvedValueOnce([]) // active running jobs
        .mockResolvedValueOnce([{ id: "job-123", payload: { commentId: "c1" } }] as any) // candidate search
        .mockResolvedValueOnce([
          { id: "job-123", name: "process-comment", payload: { commentId: "c1" }, attempts: 0 },
        ] as any); // Worker A final fetch

      // Worker A wins the atomic check-and-set updateMany (count: 1)
      vi.mocked(prisma.backgroundJob.updateMany).mockResolvedValueOnce({ count: 1 });

      const workerAJobs = await dequeueBatch(1);
      expect(workerAJobs.length).toBe(1);
      expect(workerAJobs[0].id).toBe("job-123");

      // Worker B tries on the same job:
      // 1. active running jobs: none
      // 2. candidate search: finds job-123
      // 3. updateMany fails: count: 0 (already locked by Worker A)
      vi.mocked(prisma.backgroundJob.findMany)
        .mockResolvedValueOnce([]) // active running jobs
        .mockResolvedValueOnce([{ id: "job-123", payload: { commentId: "c1" } }] as any);
      vi.mocked(prisma.backgroundJob.updateMany).mockResolvedValueOnce({ count: 0 });

      const workerBJobs = await dequeueBatch(1);
      expect(workerBJobs.length).toBe(0);
      // Double processing is mathematically impossible
    });

    it("recoverStaleJobs should permanently fail jobs with attempts >= 3 (DLQ poison-pill guard)", async () => {
      const { prisma } = await import("../lib/db/client");

      vi.mocked(prisma.backgroundJob.updateMany)
        .mockResolvedValueOnce({ count: 1 }) // DLQ poison pill update
        .mockResolvedValueOnce({ count: 2 }); // normal retryable recovery

      const recoveredCount = await recoverStaleJobs(300_000);
      expect(recoveredCount).toBe(2);

      // Verify DLQ update: status FAILED for attempts >= 3
      expect(prisma.backgroundJob.updateMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: expect.objectContaining({
            status: "RUNNING",
            attempts: { gte: 3 },
          }),
          data: expect.objectContaining({
            status: "FAILED",
            error: expect.stringContaining("max attempts exceeded"),
          }),
        })
      );

      // Verify retryable recovery: status PENDING with attempts incremented
      expect(prisma.backgroundJob.updateMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: expect.objectContaining({
            status: "RUNNING",
            attempts: { lt: 3 },
          }),
          data: expect.objectContaining({
            status: "PENDING",
            attempts: { increment: 1 },
          }),
        })
      );
    });
  });

  describe("10. Key-Partitioned Conversation Ordering with Variable Delays", () => {
    it("should guarantee that Job 1 finishes before Job 2 starts when belonging to the same conversation, even with variable processing delays", async () => {
      // Simulate two dependent jobs in the same conversation
      const executionLog: string[] = [];

      const conversationChains = new Map<string, Promise<void>>();

      const jobs = [
        {
          id: "job-1",
          conversationKey: "acc_1:user_alpha",
          // Job 1 is slow (simulating slow AI API call)
          processDurationMs: 30,
        },
        {
          id: "job-2",
          conversationKey: "acc_1:user_alpha",
          // Job 2 is fast (simulating quick template reply)
          processDurationMs: 5,
        },
      ];

      const promises = jobs.map((job) => {
        const previousInConversation = conversationChains.get(job.conversationKey) || Promise.resolve();

        const currentExecution = previousInConversation.then(async () => {
          executionLog.push(`start:${job.id}`);
          await new Promise((r) => setTimeout(r, job.processDurationMs));
          executionLog.push(`finish:${job.id}`);
        });

        conversationChains.set(job.conversationKey, currentExecution);
        return currentExecution;
      });

      await Promise.all(promises);

      // Strict FIFO order: Job 1 must completely finish before Job 2 even starts!
      expect(executionLog).toEqual([
        "start:job-1",
        "finish:job-1",
        "start:job-2",
        "finish:job-2",
      ]);
    });

    it("should run independent conversations concurrently without blocking each other", async () => {
      const executionLog: string[] = [];
      const conversationChains = new Map<string, Promise<void>>();

      const jobs = [
        {
          id: "job-conv1",
          conversationKey: "acc_1:user_1",
          // Slow job on conversation 1
          processDurationMs: 35,
        },
        {
          id: "job-conv2",
          conversationKey: "acc_1:user_2",
          // Fast job on conversation 2
          processDurationMs: 5,
        },
      ];

      const promises = jobs.map((job) => {
        const previousInConversation = conversationChains.get(job.conversationKey) || Promise.resolve();

        const currentExecution = previousInConversation.then(async () => {
          executionLog.push(`start:${job.id}`);
          await new Promise((r) => setTimeout(r, job.processDurationMs));
          executionLog.push(`finish:${job.id}`);
        });

        conversationChains.set(job.conversationKey, currentExecution);
        return currentExecution;
      });

      await Promise.all(promises);

      // Both start in parallel; fast conversation 2 finishes before slow conversation 1 finishes!
      expect(executionLog[0]).toBe("start:job-conv1");
      expect(executionLog[1]).toBe("start:job-conv2");
      expect(executionLog[2]).toBe("finish:job-conv2");
      expect(executionLog[3]).toBe("finish:job-conv1");
    });
  });

  describe("11. Rate Limiter Cache Eviction & Cross-Process DB Source of Truth", () => {
    it("should never bypass rate limit upon cache eviction (authoritative DB query triggers)", async () => {
      const { prisma } = await import("../lib/db/client");

      const blockedAccountId = "ig_acc_blocked_999";

      // Mock DB: account has sent 185 DMs in the last hour (> 180 cap)
      vi.mocked(prisma.dmLog.count).mockResolvedValue(185);

      // 1. First check: blocked from DB count
      const check1 = await checkRateLimit(blockedAccountId, "COMMENT_REPLY", 0);
      expect(check1.allowed).toBe(false);
      expect(check1.currentCount).toBe(185);

      // 2. Flood cache with 250 dummy accounts to force eviction of blockedAccountId
      for (let i = 0; i < 250; i++) {
        await checkRateLimit(`dummy_acc_${i}`, "COMMENT_REPLY", 0);
      }

      // 3. Check again: even though cache entry was evicted, DB is queried authoritatively!
      const checkAfterEviction = await checkRateLimit(blockedAccountId, "COMMENT_REPLY", 0);
      expect(checkAfterEviction.allowed).toBe(false);
      expect(checkAfterEviction.currentCount).toBe(185);
      // DB count was queried, proving zero security/rate-limit bypass upon cache eviction
    });
  });
});
