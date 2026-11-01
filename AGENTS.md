# OpenReply Intelligent Direct System — Project AGENTS.md

> **Scope:** Instagram Comment-to-DM SaaS & AI Reply Engine<br />
> **Directory:** `I:\Desktop\openreply-main`<br />
> **Test Command:** `npx vitest run` (112 Tests, 100% passing across 10 test suites)<br />
> **Build Command:** `npm run build`<br />
> **VPS Quick Launch:** `./deploy/quick-launch.sh`

---

## 1. Project Overview & Architecture

OpenReply is a high-concurrency B2B Instagram automation suite built with:
* **Frontend & API:** Next.js 16.2.6 (App Router), React 19.2.4, TypeScript, TailwindCSS v4, `@xyflow/react` v12.
* **Database & ORM:** MySQL/MariaDB 10.11+ (`digitale_digitaleliteisntal`), Prisma ORM (`@prisma/adapter-mariadb`).
* **Background Worker & Queue:** High-throughput MariaDB-backed job queue (`lib/queue/mysql-queue.ts`, `worker/dm-worker.ts`). Zero Redis dependency.
* **Authentication:** NextAuth v5 with Prisma adapter and Role-Based Access Control (`SUPER_ADMIN`, `ADMIN`, `MEMBER`).
* **PHP Booking Bridge:** Type-safe, circuit-broken SDK (`lib/services/php-booking-client.ts`) connecting to Booking CRM.
* **Production Orchestration:** Multi-stage Dockerfile (`node:20-alpine`, non-root user `nextjs`, `tini` signal handling), Docker Compose (`web`, `worker`, `mysql`).

---

## 2. Project-Specific Non-Negotiables

1. **Meta Graph API v25.0 Compliance:**
   * Always enforce the **24-hour messaging window**. Do not send promotional DMs to users who have not interacted in the last 24 hours unless using an approved Message Tag.
   * Honor the **Anti-Ban Cooldown Circuit Breaker** (Code 368 PolicyBlock). If an account is throttled by Instagram, pause dispatch immediately.
2. **Database & Migration Safety:**
   * Never execute destructive commands (`prisma db push --force-reset` or `migrate reset`) on production.
   * Early PostgreSQL migrations must be synchronized via `npm run db:baseline` (`scripts/db-baseline.ts`) to avoid SQL syntax errors on MariaDB.
   * Fresh database installs use `deploy/init-db/01-init-schema.sql`.
3. **PHP Booking Bridge Resilience:**
   * OpenReply MUST remain 100% functional even if the PHP Booking server is completely offline or returns 500 errors.
   * Always use `PhpBookingClient`. Never bypass its 60-second circuit breaker or 8-second request timeout.
4. **Cryptographic Webhook Verification:**
   * All incoming webhooks from Booking (`/api/webhook/php-booking`) must verify HMAC-SHA256 signatures (`x-signature`) and timestamps (`x-timestamp`) with 5-minute replay prevention.
5. **Persian Keyword & Normalization Rules:**
   * Instagram comment triggers must use `persian-keyword-matcher.ts` supporting Persian and Arabic unicode characters, half-spaces (`\u200C`), and informal slang.

---

## 3. Agent Operational Commands (`.agent/commands/`)

All AI coding workers and assistants MUST utilize these standardized commands:

| Command | File | Description |
| :--- | :--- | :--- |
| `/doctor` | [`.agent/commands/doctor.md`](file:///I:/Desktop/openreply-main/.agent/commands/doctor.md) | Full diagnostic check: Node, Docker, .env, Prisma, and MariaDB. |
| `/preflight` | [`.agent/commands/preflight.md`](file:///I:/Desktop/openreply-main/.agent/commands/preflight.md) | Pre-deployment environment, tooling, ports, and configuration check. |
| `/quick-launch` | [`.agent/commands/quick-launch.md`](file:///I:/Desktop/openreply-main/.agent/commands/quick-launch.md) | Execute and test the VPS Quick Launch deployment engine. |
| `/test` | [`.agent/commands/test.md`](file:///I:/Desktop/openreply-main/.agent/commands/test.md) | Execute TypeScript typecheck and Vitest 112+ test suite. |
| `/test-all` | [`.agent/commands/test-all.md`](file:///I:/Desktop/openreply-main/.agent/commands/test-all.md) | Execute complete test suite, concurrency tests, and benchmarks. |
| `/typecheck` | [`.agent/commands/typecheck.md`](file:///I:/Desktop/openreply-main/.agent/commands/typecheck.md) | Strict TypeScript compiler validation (`tsc --noEmit`). |
| `/build-check` | [`.agent/commands/build-check.md`](file:///I:/Desktop/openreply-main/.agent/commands/build-check.md) | Production Next.js compiler and Prisma client build check. |
| `/docker-check` | [`.agent/commands/docker-check.md`](file:///I:/Desktop/openreply-main/.agent/commands/docker-check.md) | Validate Dockerfile multi-stage, compose config, and non-root user. |
| `/deploy-check` | [`.agent/commands/deploy-check.md`](file:///I:/Desktop/openreply-main/.agent/commands/deploy-check.md) | Pre-flight check for Linux VPS deployment readiness. |
| `/release-check` | [`.agent/commands/release-check.md`](file:///I:/Desktop/openreply-main/.agent/commands/release-check.md) | Pre-release check: Git diff, secrets, build, and tests. |
| `/database-audit` | [`.agent/commands/database-audit.md`](file:///I:/Desktop/openreply-main/.agent/commands/database-audit.md) | Schema inspection, migration baseline, and safety audit. |
| `/security-audit` | [`.agent/commands/security-audit.md`](file:///I:/Desktop/openreply-main/.agent/commands/security-audit.md) | Security scan: port exposure, masked secrets, non-root user. |
| `/rollback-plan` | [`.agent/commands/rollback-plan.md`](file:///I:/Desktop/openreply-main/.agent/commands/rollback-plan.md) | Deterministic rollback procedure for containers and database. |
| `/docs-sync` | [`.agent/commands/docs-sync.md`](file:///I:/Desktop/openreply-main/.agent/commands/docs-sync.md) | Synchronize repository documentation with codebase and features. |

---

## 4. Key Files & Navigation

* VPS Quick Launch Script: [`deploy/quick-launch.sh`](file:///I:/Desktop/openreply-main/deploy/quick-launch.sh)
* Database Baseline Manager: [`scripts/db-baseline.ts`](file:///I:/Desktop/openreply-main/scripts/db-baseline.ts)
* Database Audit Utility: [`scripts/db-audit.ts`](file:///I:/Desktop/openreply-main/scripts/db-audit.ts)
* Pre-Flight Inspector: [`scripts/quick-check.mjs`](file:///I:/Desktop/openreply-main/scripts/quick-check.mjs)
* Docker Compose Orchestration: [`docker-compose.yml`](file:///I:/Desktop/openreply-main/docker-compose.yml)
* Production Dockerfile: [`Dockerfile`](file:///I:/Desktop/openreply-main/Dockerfile)
* PHP Booking Client: [`lib/services/php-booking-client.ts`](file:///I:/Desktop/openreply-main/lib/services/php-booking-client.ts)
* Background Worker: [`worker/dm-worker.ts`](file:///I:/Desktop/openreply-main/worker/dm-worker.ts)
* Prisma Schema: [`prisma/schema.prisma`](file:///I:/Desktop/openreply-main/prisma/schema.prisma)
