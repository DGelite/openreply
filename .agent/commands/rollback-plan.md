# Agent Command: /rollback-plan

> **Purpose:** Generate and execute a deterministic disaster recovery rollback plan covering application code, Docker images, and MariaDB database backups.

## Operational Workflow

When a production incident occurs (failed deploy, corrupted release, or broken migration), execute the following 3-step rollback plan:

### Step 1: Application Container Rollback
If a newly deployed Docker image fails health checks or introduces fatal bugs:
```bash
# 1. Stop current containers
docker compose down

# 2. Checkout previous known-good Git commit or release tag
git checkout <PREVIOUS_COMMIT_OR_TAG>

# 3. Relaunch services via Quick Launch
./deploy/quick-launch.sh --up
```

### Step 2: Database Restoration (If Schema or Data was Corrupted)
If data corruption occurred during a deploy:
```bash
# 1. List available backups
ls -lht backups/

# 2. Restore the latest pre-update backup (requires interactive CONFIRM gate)
./deploy/quick-launch.sh --restore backups/openreply_backup_<TIMESTAMP>.sql.gz
```
- The restore tool validates gzip archive integrity (`gzip -t`) before touching the database.
- Database is overwritten only after explicit confirmation.

### Step 3: Verification & Service Health Confirmation
```bash
# 1. Verify container status and resource usage
./deploy/quick-launch.sh --status

# 2. Query health check endpoint directly
curl -s http://127.0.0.1:3000/api/health | jq .

# 3. Check worker and web logs
./deploy/quick-launch.sh --logs web 50
./deploy/quick-launch.sh --logs worker 50
```
- Ensure status is `ok` (HTTP 200).
- Confirm worker heartbeat is registering and MariaDB reports 0 connectivity errors.
