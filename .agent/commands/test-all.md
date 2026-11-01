# Agent Command: /test-all

> **Purpose:** Execute the complete, rigorous OpenReply test suite including unit tests, integration tests, distributed concurrency tests, and rate limiter verification.

## Operational Workflow

When this command is invoked, the Agent MUST execute the entire test suite and verify 100% pass rate:

### 1. Vitest Test Suite Execution
Execute Vitest across all 10 test suites:
```bash
npx vitest run
```
Target Suites Covered:
- `lib/queue/__tests__/mysql-queue.test.ts` (18 tests: claim locks, transaction isolation, crash recovery, deduplication, retry backoff)
- `lib/queue/__tests__/worker-loop.test.ts` (14 tests: worker polling, batch dispatch, graceful shutdown)
- `lib/utils/__tests__/rate-limiter.test.ts` (15 tests: token bucket, window resets, concurrency safety)
- `lib/services/__tests__/php-booking-client.test.ts` (13 tests: circuit breaker, HMAC verification, 8s timeout, fail-open resiliency)
- `lib/utils/__tests__/persian-keyword-matcher.test.ts` (16 tests: unicode normalization, half-spaces `\u200C`, informal Persian/Arabic slang)
- Other API, Webhook, and Flow Engine suites (36 tests)

Total Expected Passing Tests: 112+ tests.

### 2. Standalone Concurrency Verification Scripts
Run multi-worker simulated concurrency stress test:
```bash
npx tsx scripts/test-rate-limit-concurrency.ts
```
Expected:
- 10 concurrent workers competing for rate limits without quota over-issuance.

### 3. Queue Performance Benchmark
Run queue claim performance benchmark:
```bash
npx tsx scripts/benchmark-claim-cost.ts
```
Expected:
- Single claim query cost is bounded under high queue depths.

## Expected Output Format
The Agent must output:
- Total number of tests executed and passed.
- Duration of the test run.
- Zero skipped or failed tests confirmation.
