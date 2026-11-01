# Agent Command: /quick-launch

> **Purpose:** Execute and test OpenReply's VPS automated deployment, maintenance, and orchestration engine (`deploy/quick-launch.sh` / `scripts/quick-launch.sh`).

## Operational Workflow

When this command is invoked, the Agent MUST execute or guide the execution of the Quick Launch engine across its core operational modes:

### 1. Pre-Flight Verification Mode (`--check`)
Validates host environment, Docker daemon, Docker Compose plugin, port availability, disk space, and environment variables:
```bash
# On Linux VPS:
./deploy/quick-launch.sh --check

# Or via scripts shortcut:
./scripts/quick-launch.sh --check
```

Verification Criteria:
- Docker version >= 24 and Compose plugin present.
- Ports 3000 (Web) and 3308 (MariaDB internal proxy) available.
- Free disk space >= 5 GB.
- `.env` file validated (all required keys present, no dummy secrets in production).

### 2. Full Up / Bootstrap Mode (`--up`)
Builds production multi-stage images, starts MariaDB container, waits for healthy state, executes safe baseline schema synchronization, and brings up Web & Worker:
```bash
./deploy/quick-launch.sh --up
```

Verification Criteria:
- Multi-stage Docker build finishes cleanly.
- MariaDB container reaches healthy state within 60s timeout.
- Baseline migrations applied without destructive resets.
- Next.js Web server responds on `http://127.0.0.1:3000/api/health` with HTTP 200.
- Worker process is streaming logs and listening for queue tasks.

### 3. Update & Rolling Deploy Mode (`--update`)
Pulls latest changes, creates automated safety database backup, rebuilds images, and performs a zero-downtime rolling reload:
```bash
./deploy/quick-launch.sh --update
```

### 4. Database Backup & Restore Mode (`--backup` & `--restore`)
Creates an atomic, gzipped SQL dump with SHA-256 checksum and maintains backup retention:
```bash
# Backup
./deploy/quick-launch.sh --backup

# Restore (requires interactive confirmation or explicit path)
./deploy/quick-launch.sh --restore ./backups/db-latest.sql.gz
```

### 5. Service Status & Health Inspection (`--status`)
Inspects container states, healthcheck results, memory/CPU usage, and queue backlog:
```bash
./deploy/quick-launch.sh --status
```

### 6. Log Streaming (`--logs`)
Follows synchronized logs across Web, Worker, and MariaDB containers:
```bash
./deploy/quick-launch.sh --logs
# Or specific service:
./deploy/quick-launch.sh --logs worker
```

## Expected Output Format
The Agent must deliver:
- Target mode executed.
- Step-by-step stdout/stderr summary.
- Exit code and service operational status.
