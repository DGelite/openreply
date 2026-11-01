# Agent Command: /deploy-check

> **Purpose:** Non-destructive pre-flight audit for Linux VPS readiness without requiring SSH access or server credentials.

## Operational Workflow

When this command is invoked, the Agent MUST execute:

### 1. Cross-Platform Pre-Flight Inspector
```bash
npm run check
```
- Validates Node.js >= 20.
- Validates all essential deploy scripts (`deploy/quick-launch.sh`, `deploy/init-db/01-init-schema.sql`).
- Validates `.env` variables: `DATABASE_URL`, `NEXTAUTH_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET`, `WEBHOOK_VERIFY_TOKEN`, `NEXTAUTH_URL`.

### 2. Bash Deploy Script Dry-Run (Under Bash/Git Bash)
```bash
bash deploy/quick-launch.sh --check
```
- Checks host OS and shell compatibility.
- Validates Docker and Docker Compose presence.
- Verifies disk space adequacy (>= 2GB).
- Verifies application port availability.

### 3. Database Baseline Validation
```bash
npm run db:audit
```
- Ensures MariaDB is ready and all 14 migrations are baselined.
- Confirms zero pending PostgreSQL migration syntax errors.

## Success Criteria
All commands must report clean zero exit codes or document host-specific non-blocking warnings (such as Docker daemon stopped on Windows localhost).
