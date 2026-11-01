# Agent Command: /security-audit

> **Purpose:** Security posture audit covering environment variables, secret storage, public network surface, non-root containers, and authentication safeguards.

## Operational Workflow

When this command is invoked, the Agent MUST execute:

### 1. Secret Isolation & Masking
- Verify that NO real secrets are committed in git or printed in logs.
- Verify `.env.example` has placeholder values only.
- Verify `ENCRYPTION_KEY` is a 64-character hexadecimal key (AES-256 for Meta access tokens).
- Verify `NEXTAUTH_SECRET` and `AUTH_SECRET` are high-entropy strings (min 32 chars).
- Verify `CRON_SECRET` is strong (protects `/api/cron/*` endpoints).
- Verify `WEBHOOK_VERIFY_TOKEN` matches Meta portal settings.

### 2. Network Surface & Port Exposure
- In `docker-compose.yml`, verify that MariaDB port (`3306`) is mapped ONLY to loopback:
  `127.0.0.1:${DB_PORT:-3308}:3306`
  It MUST NEVER be exposed to `0.0.0.0:3306` on a public VPS.
- Verify that only Web port (3000) is accessible from host network or reverse proxy.

### 3. Container Privilege Hardening
- Inspect `Dockerfile` for `USER nextjs` (UID 1001, GID 1001).
- Confirm containers run with non-root user privileges.
- Verify `tini` is configured as `ENTRYPOINT` to prevent zombie process accumulation.

### 4. Meta Graph API v25.0 Compliance
- 24-hour messaging window enforcement in `lib/drip/drip-engine.ts` and `lib/automation/direct-message-processor.ts`.
- Account anti-ban cooldown circuit breaker on HTTP 368 policy block in `lib/meta/client.ts`.
- HMAC-SHA256 signature verification in `/api/webhook/php-booking`.
