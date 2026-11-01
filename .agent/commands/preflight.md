# Agent Command: /preflight

> **Purpose:** Execute comprehensive pre-flight verification before deployment, checking environment prerequisites, tooling, ports, database connectivity, and configuration security.

## Operational Workflow

When this command is invoked, the Agent MUST execute the following checks:

### 1. Cross-Platform Environment Audit
```bash
node scripts/quick-check.mjs
```
Validates:
- Node.js runtime version >= 20.x.
- Docker daemon status and Docker Compose plugin availability.
- Presence and syntax of `.env` configuration file.
- Required variables: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `ENCRYPTION_KEY`, `CRON_SECRET`, `WEBHOOK_VERIFY_TOKEN`.
- Warning on exposed or default placeholder secrets.

### 2. Network Port Collision Check
Verify that target ports are not in use by conflicting local services:
```bash
# Windows PowerShell:
Test-NetConnection -ComputerName 127.0.0.1 -Port 3000
Test-NetConnection -ComputerName 127.0.0.1 -Port 3308

# Linux Bash:
ss -tulpn | grep -E ':(3000|3306|3308)\b'
```

### 3. Database Connectivity & Schema Audit
```bash
npm run db:audit
```
Validates:
- MariaDB / MySQL TCP handshake and authentication.
- Schema version and table count comparison against Prisma models.
- Migration status in `_prisma_migrations`.

### 4. Codebase Governance Check
```bash
node scripts/governance_check.mjs
```
Ensures zero hardcoded Windows filesystem paths and zero cross-root imports.

## Expected Output Format
The Agent must deliver:
- Diagnostic matrix (Tooling, Configuration, Ports, Database).
- Pass/Fail status for each subsystem.
- Actionable resolution checklist for any identified failure.
