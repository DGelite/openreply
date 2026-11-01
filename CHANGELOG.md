# Changelog

All notable changes to the OpenReply project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-10-20

### Production VPS Architecture & Linux Containerization
- **Multi-Stage Production Dockerfile:**
  - Standardized on `node:20-alpine` across `deps`, `builder`, and `runner` stages.
  - Implemented non-root system user (`nextjs:nodejs`, UID:GID 1001:1001) for strict least-privilege security.
  - Integrated `/sbin/tini` as PID 1 to ensure standard POSIX signal forwarding (`SIGTERM`/`SIGINT`) and avoid zombie processes.
  - Unified image architecture supporting both Next.js Web App Router and standalone background DM Worker.
  - Built-in container healthcheck querying `/api/health` with automatic failure detection.
- **Docker Compose Orchestration (`docker-compose.yml`):**
  - Configured three services: `web`, `worker`, and `mysql` (MariaDB 10.11 LTS).
  - Private isolated internal bridge network (`openreply-net`).
  - Restricted host port mapping on MariaDB: bound strictly to loopback `127.0.0.1:${DB_PORT:-3308}:3306` to prevent external database exposure.
  - Added `host.docker.internal:host-gateway` support to allow container connectivity to external host-managed MariaDB/MySQL instances.
  - Named persistent volume `mysql_data` with standard restart policies.
- **Production Quick Launch Engine (`deploy/quick-launch.sh`):**
  - Fully automated, idempotent bash orchestration script (624 lines) supporting:
    - `--check`: Pre-flight environment, tooling, ports, and `.env` validation.
    - `--up`: End-to-end stack build, container boot, MariaDB health wait, and baseline migration.
    - `--update`: Zero-data-loss rolling deployment with pre-update automated database backup.
    - `--status`: Real-time container metrics, health probe, and queue backlog analysis.
    - `--logs`: Unified log streaming across web, worker, and database services.
    - `--backup`: Compressed atomic gzip dumps with SHA-256 verification and retention cleanup.
    - `--restore`: Protected database restore with interactive safety gate.
    - `--rollback`: Emergency operational rollback procedure.
  - Cross-platform helper script at `scripts/quick-launch.sh`.

### Distributed Queue & Concurrency Safety
- **High-Throughput MariaDB Queue Engine (`lib/queue/mysql-queue.ts`):**
  - Eliminates external Redis dependency; fully transactional queue backed by MariaDB 10.11+.
  - Added unique worker claim identification via `lockedBy` (UUID + PID) and `lockedAt` timestamp.
  - Strict SQL deterministic ordering: `runAt ASC, createdAt ASC, id ASC`.
  - **Conversation-Level Serialization:** Prevents race conditions where two workers concurrently process messages for the same Instagram conversation.
  - Crash recovery & lock lease renewal mechanism for stale/interrupted jobs.
  - Atomic batch claim with bounded query execution cost.
- **Distributed Token Bucket Rate Limiter (`lib/utils/rate-limiter.ts`):**
  - Atomic window reservation and token consumption.
  - Prevents burst quota over-issuance across concurrent workers.
  - Meta Graph API v25.0 compliance with automatic cool-off circuit breaker on Code 368 PolicyBlock.

### Security, Governance & Verification
- **Automated Governance Linter (`scripts/governance_check.mjs`):**
  - Enforces zero hardcoded Windows filesystem paths in production and library code.
  - Prevents relative imports from escaping repository root.
- **Pre-Flight Health Inspector (`scripts/quick-check.mjs`):**
  - Cross-platform Node.js script validating Node 20+, Docker daemon, Compose plugin, and `.env` presence with masked secrets.
- **Database Baseline Synchronization (`scripts/db-baseline.ts` & `scripts/db-audit.ts`):**
  - Safe migration synchronization without destructive resets (`prisma db push --force-reset` prohibited).
- **Comprehensive Agent Command Suite (`.agent/commands/`):**
  - Standardized operational commands: `/doctor`, `/preflight`, `/quick-launch`, `/test`, `/test-all`, `/typecheck`, `/build-check`, `/docker-check`, `/deploy-check`, `/release-check`, `/database-audit`, `/security-audit`, `/rollback-plan`, `/docs-sync`.
- **Git Normalization & CI Automation:**
  - Added `.gitattributes` to enforce LF line endings on shell scripts (`*.sh`) and prevent Windows CRLF syntax errors in Linux environments.
  - Modernized `.github/workflows/ci.yml` targeting Node 20, MariaDB/MySQL datasource, type checking, governance linting, test suites, and production build.
- **Vitest Test Suite Expansion:**
  - 112 tests passing with 100% success rate across 10 test suites covering queue concurrency, worker loops, rate limiting, Persian keyword normalization, and PHP booking client resilience.
