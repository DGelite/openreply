# OpenReply Database Architecture & Migration Guide

> **Primary Datastore:** MariaDB 10.11+ / MySQL 8.0  
> **ORM:** Prisma 7.9 with `@prisma/adapter-mariadb`  
> **Queue Engine:** MariaDB `BackgroundJob` table (`lib/queue/mysql-queue.ts`)  
> **Baseline Manager:** `scripts/db-baseline.ts`

---

## 1. Architecture & The Historical PostgreSQL Migration Context

OpenReply was initially forked from an early prototype that generated Prisma migrations using a PostgreSQL provider. Those early migrations (numbered `20260517...` through `20260525...`) contain PostgreSQL-specific DDL syntax:
- `CREATE SCHEMA IF NOT EXISTS "public";`
- `CREATE TYPE ... AS ENUM (...)`
- `TIMESTAMP(3)` instead of `DATETIME(3)`
- `JSONB` instead of `JSON`

In modern OpenReply, the architecture has been standardized around **MariaDB 10.11+** with the high-performance `@prisma/adapter-mariadb` driver adapter.

### The Problem
If `npx prisma migrate deploy` is run directly against an existing MariaDB database without proper migration history, Prisma attempts to execute migration `20260517120000_b2b_saas_foundation`, which fails immediately with a fatal MariaDB syntax error on `CREATE SCHEMA` / `CREATE TYPE`.

### The Solution: Deterministic Baselining
OpenReply provides a dedicated baseline utility (`scripts/db-baseline.ts`) that:
1. Creates the `_prisma_migrations` table with native MariaDB syntax if it does not already exist.
2. Calculates exact SHA256 checksums of each migration in `prisma/migrations/`.
3. Records all 14 baseline migrations as applied (`finished_at = NOW()`).
4. Allows subsequent migrations (from `20260729...` onward) to execute smoothly through `prisma migrate deploy` without syntax failures.

---

## 2. Managing Migrations in Development & Production

### A. Checking Database & Migration Status
Run the automated database auditor:
```bash
npm run db:audit
```
This inspects:
- MariaDB connectivity and version.
- Total table count.
- Whether `_prisma_migrations` table exists.
- List of applied migrations.
- Verification that all critical models (`User`, `Workspace`, `InstagramAccount`, `Automation`, `DmLog`, `BackgroundJob`, `Lead`, `OperationalEvent`) are present.

### B. Baselining an Existing MariaDB Database
If deploying to a server with an existing database dump or unmanaged tables:
```bash
# Dry-run audit (no changes)
npm run db:baseline -- --dry-run

# Execute baseline
npm run db:baseline
```

After baselining, verify that Prisma recognizes the schema is in sync:
```bash
npx prisma migrate status
```
Expected output:
```text
14 migrations found in prisma/migrations
Database schema is up to date!
```

### C. Creating a Fresh Database from Scratch
For brand new environments or automated container initialization:
- The pristine native MariaDB DDL is stored in [`deploy/init-db/01-init-schema.sql`](../deploy/init-db/01-init-schema.sql).
- Docker Compose automatically executes this script when initializing a new MariaDB container volume.
- To re-generate this DDL after changing `prisma/schema.prisma`:
  ```bash
  npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script -o deploy/init-db/01-init-schema.sql
  ```

---

## 3. Creating New Schema Migrations (Developer Guide)

When adding new models or columns to `prisma/schema.prisma`:

1. Update `prisma/schema.prisma`.
2. Generate a native MySQL migration:
   ```bash
   npx prisma migrate dev --name <descriptive_migration_name>
   ```
3. Verify that the generated `migration.sql` uses valid MySQL/MariaDB syntax (e.g. `ALTER TABLE \`User\` ADD COLUMN ...`).
4. Run tests:
   ```bash
   npm run typecheck
   npx vitest run
   ```
5. Deploy safely in production:
   ```bash
   ./deploy/quick-launch.sh --update
   ```

---

## 4. Production Safety Rules

- **NEVER** run `prisma db push --force-reset` on production. This permanently destroys customer data.
- **NEVER** run `prisma migrate reset` on production.
- Always create a compressed backup (`./deploy/quick-launch.sh --backup`) before applying schema migrations.
- In case of a bad migration, follow the [Disaster Recovery Rollback Guide](backup-restore.md).
