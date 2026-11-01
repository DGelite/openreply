# Agent Command: /docker-check

> **Purpose:** Validate Dockerfile multi-stage builds, Docker Compose service orchestration, build context exclusions, non-root user permissions, and health check definitions.

## Operational Workflow

When this command is invoked, the Agent MUST audit the container infrastructure:

### 1. Docker Compose Configuration Syntax
```bash
docker compose config
```
- Verify zero syntax errors.
- Verify services defined:
  - `web` (Next.js App Server, port 3000, non-root user `nextjs`)
  - `worker` (Dedicated background queue processor, `dm-worker.ts`)
  - `mysql` (MariaDB 10.11 LTS, loopback port binding `127.0.0.1:3308`)
- Verify no Redis service is hardcoded as an obligatory dependency.

### 2. Docker Ignore & Context Security
Inspect `.dockerignore` to confirm:
- `.env*` (except `.env.example`) are excluded.
- `node_modules`, `.next`, `build-output.txt` are excluded.
- `backups`, `*.zip`, `*.sql` dumps are excluded.
- `deploy/init-db/01-init-schema.sql` is tracked properly in Git.

### 3. Dockerfile Multi-Stage & Hardening Review
Verify `Dockerfile`:
- Base: `node:20-alpine`.
- Stages: `deps` (npm ci) -> `builder` (npx prisma generate + next build) -> `runner`.
- Signals: `ENTRYPOINT ["/sbin/tini", "--"]`.
- User: `USER nextjs` (UID 1001, GID 1001) for non-root execution.
- Shared assets: Copies `worker/`, `lib/`, `tsconfig.json`, `prisma/` to support both Web and Worker services from one cached image.
- Healthcheck: Probes `/api/health` with curl and 3 retries.

### 4. Build Test (If Docker Daemon is active)
```bash
docker compose build
```
- If Docker daemon is offline, document that daemon is stopped and report static file validation results.
