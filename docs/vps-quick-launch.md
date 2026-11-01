# OpenReply Production VPS Quick Launch Guide

> **Target OS:** Ubuntu 22.04 LTS / Ubuntu 24.04 LTS / Debian 12  
> **Recommended Hardware:** 2 vCPU, 4GB RAM, 20GB SSD  
> **Stack:** Docker Engine, Docker Compose Plugin, Next.js 16, MariaDB 10.11, Nginx / Caddy

This guide walks through deploying OpenReply to a Linux VPS from a blank server to production with HTTPS, automated backups, and background workers.

---

## Step 1: VPS Initial Preparation & Security Hardening

Connect to your VPS as `root` or an administrative `sudo` user:

```bash
# 1. Update system packages
sudo apt-get update && sudo apt-get upgrade -y

# 2. Install essential utilities
sudo apt-get install -y curl wget git ufw htop jq

# 3. Configure firewall (UFW)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw --force enable
sudo ufw status
```

> **Security Note:** Port `3000` (Next.js) and `3306`/`3308` (MariaDB) should **NEVER** be opened in UFW. They run securely behind internal Docker networks or loopback (`127.0.0.1`).

---

## Step 2: Install Docker Engine & Compose Plugin

Install official Docker packages using the official convenience script:

```bash
# 1. Install Docker Engine
curl -fsSL https://get.docker.com | sh

# 2. Enable and start Docker service
sudo systemctl enable docker
sudo systemctl start docker

# 3. Add your current user to the docker group (avoid needing sudo)
sudo usermod -aG docker $USER
newgrp docker

# 4. Verify installation
docker --version
docker compose version
```

---

## Step 3: Clone the OpenReply Repository

```bash
cd /opt
sudo git clone https://github.com/diwenne/openreply.git
sudo chown -R $USER:$USER /opt/openreply
cd /opt/openreply
```

---

## Step 4: Configure Environment Variables

Create your production `.env` from the template:

```bash
cp .env.example .env
nano .env
```

### Essential Production Variables Checklist

| Variable | Description | Example / Recommendation |
| :--- | :--- | :--- |
| `NEXTAUTH_URL` | Public HTTPS domain of OpenReply | `https://insta.yourdomain.com` |
| `NEXTAUTH_SECRET` | 32+ character random string for session tokens | `openssl rand -hex 32` |
| `AUTH_SECRET` | Match `NEXTAUTH_SECRET` | `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | Exact 64-hexadecimal characters for AES-256 tokens | `openssl rand -hex 32` |
| `CRON_SECRET` | Random string protecting `/api/cron/*` endpoints | `openssl rand -hex 24` |
| `WEBHOOK_VERIFY_TOKEN` | Token entered in Meta Developer Webhook setup | `your_secure_verify_token` |
| `DATABASE_URL` | MariaDB connection string (Docker internal) | `mysql://openreply:YOUR_DB_PASS@mysql:3306/digitale_digitaleliteisntal` |
| `DB_USER` | MariaDB username | `openreply` |
| `DB_PASS` | Strong database password | `your_secret_db_pass` |
| `DB_ROOT_PASSWORD` | MariaDB root password | `your_secret_root_pass` |
| `INSTAGRAM_APP_ID` | Meta Developer App ID | From Meta Dashboard |
| `INSTAGRAM_APP_SECRET`| Meta Developer App Secret | From Meta Dashboard |
| `FACEBOOK_APP_SECRET` | Meta Facebook App Secret | From Meta Dashboard |
| `RESEND_API_KEY` | Transactional email provider for login links | `re_...` |
| `EMAIL_FROM` | Sender email address | `OpenReply <auth@yourdomain.com>` |
| `GEMINI_API_KEY` | (Optional) Google AI Gemini API Key | `AIza...` |
| `PHP_BOOKING_ENABLED` | Set `false` for standalone, `true` for CRM mesh | `false` or `true` |

> 🔑 **Quick Key Generation:**  
> Run `openssl rand -hex 32` in terminal to generate secure random keys for `NEXTAUTH_SECRET` and `ENCRYPTION_KEY`.

---

## Step 5: Database Baseline & Migration Verification

OpenReply includes built-in safeguards to protect against historical PostgreSQL migration incompatibilities on MariaDB:

- **Fresh VPS Install:** Docker Compose mounts `deploy/init-db/01-init-schema.sql` automatically when the `mysql_data` volume is created.
- **Existing MariaDB Database:** The Quick Launch script automatically invokes `npm run db:baseline` to safely register the 14 baseline migrations without destructive schema altering.

To inspect database health at any time:
```bash
./deploy/quick-launch.sh --check
```

---

## Step 6: Run Pre-Flight Audit

Make the launch script executable and run the non-destructive pre-flight check:

```bash
chmod +x deploy/quick-launch.sh
./deploy/quick-launch.sh --check
```

This verifies:
- Host OS & Bash shell.
- Docker daemon status.
- Docker compose plugin availability.
- Repository files integrity.
- `.env` variable presence and minimum length validation (all secrets masked).
- Disk space availability (minimum 2GB free).
- Port 3000 availability.

---

## Step 7: Launch OpenReply Stack

Launch all services (`web`, `worker`, `mysql`):

```bash
./deploy/quick-launch.sh --up
```

The script will:
1. Build the multi-stage production Docker image (`openreply:latest`).
2. Start the MariaDB container and await health check.
3. Synchronize migration baselines.
4. Start the Next.js web application and dedicated queue worker.
5. Probe the health endpoint until responsive.

---

## Step 8: Verify Service Health Check

Inspect the running status:

```bash
./deploy/quick-launch.sh --status
```

Direct HTTP probe:
```bash
curl -s http://127.0.0.1:3000/api/health | jq .
```

Expected JSON response:
```json
{
  "status": "ok",
  "checks": {
    "database": { "status": "ok" },
    "queue": {
      "status": "ok",
      "counts": { "waiting": 0, "active": 0, "delayed": 0, "failed": 0 }
    },
    "worker": {
      "healthy": true,
      "heartbeat": { "status": "running", "worker": "dm" }
    }
  }
}
```

---

## Step 9: Configure Domain, Reverse Proxy & SSL (HTTPS)

### Option A: Using Nginx & Certbot (Recommended)

1. Install Nginx and Certbot:
```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

2. Create `/etc/nginx/sites-available/openreply`:
```nginx
server {
    server_name insta.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }
}
```

3. Enable the site and request SSL certificate:
```bash
sudo ln -s /etc/nginx/sites-available/openreply /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Issue free Let's Encrypt SSL certificate:
sudo certbot --nginx -d insta.yourdomain.com
```

### Option B: Using Caddy (Automatic HTTPS)

```caddyfile
insta.yourdomain.com {
    reverse_proxy 127.0.0.1:3000
}
```

---

## Step 10: Monitoring Logs

Stream live logs safely without exposing secrets:

```bash
# All services
./deploy/quick-launch.sh --logs

# Dedicated background worker only
./deploy/quick-launch.sh --logs worker

# Web application only (last 100 lines)
./deploy/quick-launch.sh --logs web 100

# MariaDB container only
./deploy/quick-launch.sh --logs mysql
```

---

## Step 11: Zero-Data-Loss Updates

When a new version of OpenReply is released:

```bash
./deploy/quick-launch.sh --update
```

The update sequence:
1. Automatically creates a verified, compressed MariaDB backup before touching code.
2. Fast-forwards Git commits (`git merge --ff-only`).
3. Rebuilds the production Docker image.
4. Checks for any new database migrations.
5. Restarts containers with zero downtime.
6. Cleans up dangling Docker images.

---

## Step 12: Database Backup & Restore

### Automated / Manual Backup
```bash
./deploy/quick-launch.sh --backup
```
- Creates `backups/openreply_backup_YYYYMMDD_HHMMSS.sql.gz`.
- Tests gzip integrity immediately (`gzip -t`).
- Automatically maintains last 10 backups (purges older archives).

### Setting Up Nightly Cron Backup
Add to root crontab (`sudo crontab -e`):
```cron
0 3 * * * /opt/openreply/deploy/quick-launch.sh --backup >> /var/log/openreply-backup.log 2>&1
```

### Safe Database Restoration
```bash
./deploy/quick-launch.sh --restore
```
- Lists available backups.
- Verifies archive integrity before touching the database.
- Requires interactive confirmation (`Type 'CONFIRM'`).

---

## Step 13: Troubleshooting & Rollback

### If Container Fails to Start
```bash
# Check container status
docker compose ps

# Check detailed web logs
docker compose logs web --tail 50
```

### Rollback Procedure
```bash
./deploy/quick-launch.sh --rollback
```

1. **Rollback Application Code:**
   ```bash
   git checkout <PREVIOUS_COMMIT_OR_TAG>
   ./deploy/quick-launch.sh --up
   ```

2. **Rollback Database (if corrupted):**
   ```bash
   ./deploy/quick-launch.sh --restore backups/<TARGET_BACKUP>.sql.gz
   ```
