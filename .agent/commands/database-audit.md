# Agent Command: /database-audit

> **Purpose:** Deep schema inspection, MariaDB migration compatibility analysis, baseline verification, and destructive change risk audit.

## Operational Workflow

When this command is invoked, the Agent MUST execute:

### 1. Database Connectivity & Table Count
```bash
npm run db:audit
```
- Verify connection to `DATABASE_URL`.
- Fetch MariaDB / MySQL version.
- Count total tables in database.
- Verify presence of critical models (`User`, `Workspace`, `InstagramAccount`, `Automation`, `DmLog`, `BackgroundJob`, `Lead`, `OperationalEvent`).

### 2. Migration History & Baseline Inspection
- Verify if `_prisma_migrations` table exists.
- If missing, execute:
  ```bash
  npm run db:baseline
  ```
  to record the 14 baseline migrations with correct sha256 checksums without destructive SQL execution.
- Run:
  ```bash
  npx prisma migrate status
  ```
  Expected output: `Database schema is up to date!`

### 3. Destruction Prevention Rules
- NEVER run `npx prisma db push --force-reset` on production.
- NEVER run `prisma migrate reset` on production.
- Ensure startup scripts do not invoke automatic schema dropping.
- Verify backups exist or are documented in `deploy/quick-launch.sh --backup`.
