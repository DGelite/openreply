# OpenReply Backup, Restore & Disaster Recovery Guide

> **Storage Format:** Gzip-compressed SQL dumps (`.sql.gz`)  
> **Retention Policy:** 10 recent backups retained  
> **Integrity Verification:** Tested via `gzip -t` and table count audits

---

## 1. Backup Strategy Overview

OpenReply handles critical business data:
- Instagram OAuth tokens (encrypted with AES-256 via `ENCRYPTION_KEY`).
- Active automations, comment triggers, and visual flow graphs.
- Direct message logs, rate limit counters, and lead form submissions.
- Background queue states and operational logs.

Backups are executed directly from MariaDB using `mariadb-dump` / `mysqldump` with `--single-transaction` to ensure consistent point-in-time snapshots without locking tables or degrading performance.

---

## 2. Creating Backups

### A. Manual Backup via Quick Launch
```bash
./deploy/quick-launch.sh --backup
```
- Dumps database to `backups/openreply_backup_YYYYMMDD_HHMMSS.sql.gz`.
- Tests gzip archive integrity (`gzip -t`).
- Automatically prunes older backups beyond the 10 most recent.

### B. Automated Nightly Scheduled Backup
Add a cron job on your Linux VPS:
```bash
sudo crontab -e
```
Add this entry (runs daily at 03:00 AM UTC):
```cron
0 3 * * * /opt/openreply/deploy/quick-launch.sh --backup >> /var/log/openreply-backup.log 2>&1
```

### C. Pre-Update Automatic Backup
Whenever `./deploy/quick-launch.sh --update` is run, the script automatically generates a full database backup before pulling new code or rebuilding containers.

---

## 3. Restoring from a Backup

### Restoration Procedure
```bash
./deploy/quick-launch.sh --restore
```
1. Displays all available backups with timestamps and sizes.
2. Prompts you to select or input the target file path.
3. Performs integrity test (`gzip -t`) on the archive.
4. Requires explicit safety confirmation (`Type 'CONFIRM' to restore`).
5. Streams gunzipped SQL directly into the MariaDB database.
6. Runs `npm run db:audit` to verify restored tables and health.

---

## 4. Disaster Recovery & Incident Rollback

### Scenario 1: A Release Fails Health Checks After Update
1. Roll back the Docker containers to the previous Git commit or tag:
   ```bash
   git checkout <PREVIOUS_STABLE_COMMIT>
   ./deploy/quick-launch.sh --up
   ```
2. Verify service recovery:
   ```bash
   ./deploy/quick-launch.sh --status
   ```

### Scenario 2: Data Corruption or Accidental Deletion
1. Stop incoming traffic or pause queue workers:
   ```bash
   docker compose stop worker web
   ```
2. Restore the latest known good backup:
   ```bash
   ./deploy/quick-launch.sh --restore backups/openreply_backup_<TIMESTAMP>.sql.gz
   ```
3. Restart services:
   ```bash
   ./deploy/quick-launch.sh --up
   ```
4. Confirm health:
   ```bash
   curl -s http://127.0.0.1:3000/api/health | jq .
   ```

---

## 5. Security & Git Safeguards

- Backups are stored in `backups/` and `deploy/backups/`.
- Both directories are strictly excluded in `.gitignore` and `.dockerignore`.
- **NEVER** commit `.sql.gz` or `.sql` dump files to Git version control.
- Ensure only root and the deployment user have read permissions on `backups/`:
  ```bash
  chmod 700 /opt/openreply/backups
  ```
