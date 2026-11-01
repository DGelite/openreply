# Agent Command: /doctor

> **Purpose:** Comprehensive diagnostic health audit of the OpenReply environment, toolchains, configuration, Prisma, and MariaDB connectivity.

## Operational Workflow

When this command is invoked, the Agent MUST execute the following verification steps sequentially:

### 1. Environment & Tools Verification
Run the automated cross-platform health inspector:
```bash
npm run check
```
- Verify Node.js version is >= 20.
- Verify Docker CLI and Docker Compose are present.
- Verify `.env` is present and contains required variables:
  `DATABASE_URL`, `NEXTAUTH_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET`, `WEBHOOK_VERIFY_TOKEN`, `NEXTAUTH_URL`.

### 2. Database & Schema Diagnostics
Run the database audit tool:
```bash
npm run db:audit
```
- Verify MariaDB connection is alive.
- Check table counts against Prisma models.
- Verify `_prisma_migrations` status and baseline readiness.

### 3. Prisma Schema Integrity
Run:
```bash
npx prisma validate
```
- Ensure `prisma/schema.prisma` parses with zero errors.

### 4. Code Governance
Run:
```bash
node scripts/governance_check.mjs
```
- Ensure zero hardcoded Windows absolute paths and zero cross-root relative imports.

## Expected Output Format
The Agent must deliver a markdown report with:
- Tool versions (Node, npm, Docker).
- Environment validation (all secrets masked).
- Database connection status and table count.
- Prisma schema status.
- Actionable steps if any check failed.
