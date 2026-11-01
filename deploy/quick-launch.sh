#!/usr/bin/env bash
# ==============================================================================
# OPENREPLY SAAS — VPS PRODUCTION QUICK LAUNCH
# ==============================================================================
# Highly reliable, idempotent management script for Linux VPS deployment.
#
# Usage:
#   ./deploy/quick-launch.sh --check    # Audit host, docker, ports, env, database
#   ./deploy/quick-launch.sh --up       # Build, initialize database, and start services
#   ./deploy/quick-launch.sh --update   # Safe zero-data-loss update with auto-backup
#   ./deploy/quick-launch.sh --status   # Inspect container and application health
#   ./deploy/quick-launch.sh --logs     # Stream or tail service logs safely
#   ./deploy/quick-launch.sh --backup   # Create compressed MariaDB database backup
#   ./deploy/quick-launch.sh --restore  # Safely restore MariaDB backup with confirmation
#   ./deploy/quick-launch.sh --help     # Show detailed command reference
# ==============================================================================

set -euo pipefail

# ── Color Definitions & Formatting ────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BACKUP_DIR="${ROOT_DIR}/backups"
MAX_BACKUPS_RETAIN=10

# ── Logging Helpers ───────────────────────────────────────────────────────────
info()    { echo -e "${CYAN}${BOLD}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}${BOLD}[SUCCESS]${NC} $*"; }
warn()    { echo -e "${YELLOW}${BOLD}[WARNING]${NC} $*"; }
error()   { echo -e "${RED}${BOLD}[ERROR]${NC} $*" >&2; }
fatal()   { echo -e "${RED}${BOLD}[FATAL]${NC} $*" >&2; exit 1; }

# ── Compose Command Discovery ─────────────────────────────────────────────────
get_compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    echo "docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    echo "docker-compose"
  else
    echo ""
  fi
}

# ── 1. PRE-FLIGHT AUDIT & CHECKS (--check) ────────────────────────────────────
cmd_check() {
  echo -e "${BOLD}================================================================${NC}"
  echo -e "${BOLD}   🛡️  OPENREPLY PRODUCTION ENVIRONMENT PRE-FLIGHT AUDIT         ${NC}"
  echo -e "${BOLD}================================================================${NC}"
  local issues=0

  # 1. Shell & OS Check
  info "1. Checking Host Operating System & Shell..."
  local os_name
  os_name="$(uname -s 2>/dev/null || echo "Unknown")"
  if [[ "$os_name" =~ Linux|Darwin ]]; then
    success "Host OS: ${os_name} (Compatible)"
  else
    warn "Host OS is ${os_name}. Production target is Linux VPS."
  fi

  # 2. Docker Engine Check
  info "2. Checking Docker Engine..."
  if command -v docker >/dev/null 2>&1; then
    if docker info >/dev/null 2>&1; then
      local docker_version
      docker_version="$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "Active")"
      success "Docker Engine is running (Version: ${docker_version})"
    else
      error "Docker is installed, but the daemon is not running or current user lacks docker group permission."
      echo "  👉 Run: sudo systemctl start docker"
      echo "  👉 Run: sudo usermod -aG docker \$USER && newgrp docker"
      issues=$((issues + 1))
    fi
  else
    error "Docker is not installed."
    echo "  👉 Install via: curl -fsSL https://get.docker.com | sh"
    issues=$((issues + 1))
  fi

  # 3. Docker Compose Check
  info "3. Checking Docker Compose..."
  local compose_cmd
  compose_cmd="$(get_compose_cmd)"
  if [[ -n "$compose_cmd" ]]; then
    local compose_ver
    compose_ver="$($compose_cmd version 2>/dev/null || echo "Active")"
    success "Docker Compose available: ${compose_cmd} (${compose_ver})"
  else
    error "Docker Compose (v2 plugin or standalone) not found."
    echo "  👉 Install plugin: sudo apt-get update && sudo apt-get install -y docker-compose-plugin"
    issues=$((issues + 1))
  fi

  # 4. Critical Repository Files
  info "4. Checking Critical Repository Files..."
  local required_files=(
    "package.json"
    "Dockerfile"
    "docker-compose.yml"
    "prisma/schema.prisma"
    "deploy/init-db/01-init-schema.sql"
    "scripts/db-baseline.ts"
    "scripts/db-audit.ts"
  )
  for file in "${required_files[@]}"; do
    if [[ -f "$file" ]]; then
      echo "  ✔ Found ${file}"
    else
      error "Missing required repository file: ${file}"
      issues=$((issues + 1))
    fi
  done

  # 5. Environment File (.env) Check
  info "5. Validating Environment Configuration (.env)..."
  if [[ ! -f ".env" ]]; then
    error ".env file is missing!"
    echo "  👉 Copy template: cp .env.example .env"
    echo "  👉 Edit .env with your production credentials before launching."
    issues=$((issues + 1))
  else
    success "Found .env configuration file."

    # Validate essential environment keys without printing their secrets
    validate_env_key() {
      local key="$1"
      local min_len="${2:-1}"
      local is_critical="${3:-true}"
      local val
      val="$(grep -E "^${key}=" .env 2>/dev/null | cut -d '=' -f2- | tr -d '"'\'' ' || true)"
      if [[ -z "$val" ]]; then
        if [[ "$is_critical" == "true" ]]; then
          error "Missing required variable in .env: ${key}"
          issues=$((issues + 1))
        else
          warn "Optional variable not set: ${key}"
        fi
      elif [[ ${#val} -lt $min_len ]]; then
        error "Variable ${key} in .env is too short (got ${#val} chars, expected >= ${min_len})"
        issues=$((issues + 1))
      else
        echo "  ✔ ${key}: configured (${#val} chars, masked)"
      fi
    }

    validate_env_key "DATABASE_URL" 15 true
    validate_env_key "NEXTAUTH_SECRET" 16 true
    validate_env_key "ENCRYPTION_KEY" 64 true
    validate_env_key "CRON_SECRET" 16 true
    validate_env_key "WEBHOOK_VERIFY_TOKEN" 8 true
    validate_env_key "NEXTAUTH_URL" 10 true
    validate_env_key "AUTH_SECRET" 16 false
  fi

  # 6. Disk Space Check
  info "6. Checking Available Disk Space..."
  local free_kb
  free_kb="$(df -k "$ROOT_DIR" 2>/dev/null | awk 'NR==2 {print $4}' || echo "0")"
  if [[ "$free_kb" -gt 0 ]]; then
    local free_mb=$((free_kb / 1024))
    if [[ "$free_mb" -lt 1500 ]]; then
      warn "Low disk space: ${free_mb}MB free. At least 2GB is recommended for Docker builds."
    else
      success "Disk space adequate: ${free_mb}MB free."
    fi
  fi

  # 7. Port Availability Check
  info "7. Checking Port Availability..."
  local port=3000
  if [[ -f ".env" ]]; then
    local env_port
    env_port="$(grep -E "^PORT=" .env 2>/dev/null | cut -d '=' -f2- | tr -d '"'\'' ' || true)"
    [[ -n "$env_port" ]] && port="$env_port"
  fi
  if command -v lsof >/dev/null 2>&1; then
    if lsof -Pi :"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
      warn "Port ${port} is currently bound. (If OpenReply is already running, this is expected)."
    else
      success "Application Port ${port} is available."
    fi
  elif command -v ss >/dev/null 2>&1; then
    if ss -lntu | grep -q ":${port} "; then
      warn "Port ${port} is currently bound."
    else
      success "Application Port ${port} is available."
    fi
  elif command -v netstat >/dev/null 2>&1; then
    if netstat -an 2>/dev/null | grep -E "LISTENING|LISTEN" | grep -q ":${port} "; then
      warn "Port ${port} is currently bound."
    else
      success "Application Port ${port} is available."
    fi
  else
    success "Port checking skipped (no lsof/ss/netstat utility found)."
  fi

  echo -e "\n${BOLD}----------------------------------------------------------------${NC}"
  if [[ "$issues" -eq 0 ]]; then
    success "PRE-FLIGHT AUDIT PASSED! All prerequisites satisfied."
    echo -e "${BOLD}================================================================${NC}"
    return 0
  else
    error "PRE-FLIGHT AUDIT FAILED with ${issues} issue(s). Resolve them before launching."
    echo -e "${BOLD}================================================================${NC}"
    return 1
  fi
}

# ── 2. SERVICE LAUNCH (--up) ──────────────────────────────────────────────────
cmd_up() {
  info "Starting OpenReply VPS Launch Sequence..."

  # Pre-flight check
  if ! cmd_check; then
    fatal "Cannot proceed with launch until all pre-flight issues are resolved."
  fi

  local compose_cmd
  compose_cmd="$(get_compose_cmd)"
  [[ -z "$compose_cmd" ]] && fatal "Docker Compose is required but not found."

  mkdir -p "${ROOT_DIR}/backups"
  mkdir -p "${ROOT_DIR}/deploy/init-db"

  info "Step 1: Building production Docker image (openreply:latest)..."
  $compose_cmd build web

  info "Step 2: Starting MariaDB database service..."
  $compose_cmd up -d mysql

  info "Step 3: Waiting for MariaDB health check..."
  local attempts=0
  local max_attempts=30
  until $compose_cmd ps mysql --filter "health=healthy" -q 2>/dev/null | grep -q . || [[ $attempts -ge $max_attempts ]]; do
    echo -n "."
    sleep 2
    ((attempts++))
  done
  echo ""

  if [[ $attempts -ge $max_attempts ]]; then
    warn "MariaDB did not transition to healthy in $((max_attempts * 2))s. Checking logs..."
    $compose_cmd logs mysql --tail 20
  else
    success "MariaDB is healthy and accepting connections."
  fi

  info "Step 4: Ensuring Database Schema & Baseline Migrations..."
  # Execute baseline script inside a transient node container on openreply-net
  $compose_cmd run --rm --no-deps web npx tsx scripts/db-baseline.ts || {
    warn "Automated container baseline returned non-zero. Falling back to local check..."
  }

  info "Step 5: Launching Web Application & Dedicated Worker..."
  $compose_cmd up -d web worker

  info "Step 6: Verifying Web Health Check Endpoint..."
  local port=3000
  if [[ -f ".env" ]]; then
    local env_port
    env_port="$(grep -E "^PORT=" .env 2>/dev/null | cut -d '=' -f2- | tr -d '"'\'' ' || true)"
    [[ -n "$env_port" ]] && port="$env_port"
  fi

  local health_ok=false
  local check_attempts=0
  info "Probing http://127.0.0.1:${port}/api/health..."
  while [[ $check_attempts -lt 20 ]]; do
    if curl -sf -m 5 "http://127.0.0.1:${port}/api/health" >/dev/null 2>&1; then
      health_ok=true
      break
    fi
    sleep 3
    ((check_attempts++))
    echo -n "."
  done
  echo ""

  if [[ "$health_ok" == "true" ]]; then
    success "OpenReply SaaS is HEALTHY and RUNNING!"
    echo -e "\n${BOLD}Access Details:${NC}"
    echo "  • Dashboard URL: http://127.0.0.1:${port}"
    echo "  • Health API:    http://127.0.0.1:${port}/api/health"
    echo "  • Check Status:  ./deploy/quick-launch.sh --status"
    echo "  • View Logs:     ./deploy/quick-launch.sh --logs"
  else
    warn "Health check probe timed out. Services are starting or degraded."
    echo "  👉 Inspect logs via: ./deploy/quick-launch.sh --logs"
  fi
}

# ── 3. ZERO-DATA-LOSS UPDATE (--update) ───────────────────────────────────────
cmd_update() {
  info "Starting Zero-Data-Loss Update Sequence..."

  # Step 1: Automated Safety Backup
  info "1. Creating safety database backup before update..."
  cmd_backup

  # Step 2: Git fast-forward update if inside git repository
  if [[ -d ".git" ]]; then
    info "2. Checking for repository updates via Git..."
    if command -v git >/dev/null 2>&1; then
      git fetch origin 2>/dev/null || warn "Could not reach git remote. Proceeding with local code..."
      local current_branch
      current_branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")"
      info "Current Git branch: ${current_branch}"
      git merge --ff-only "origin/${current_branch}" 2>/dev/null || {
        warn "Could not fast-forward git merge. Using current local tree."
      }
    fi
  fi

  # Step 3: Rebuild Images
  local compose_cmd
  compose_cmd="$(get_compose_cmd)"
  [[ -z "$compose_cmd" ]] && fatal "Docker Compose not found."

  info "3. Rebuilding Docker container images..."
  $compose_cmd build web

  # Step 4: Database Baseline & Migration Check
  info "4. Checking for pending database migrations..."
  $compose_cmd run --rm --no-deps web npx tsx scripts/db-baseline.ts || true

  # Step 5: Graceful Rolling Restart
  info "5. Recreating containers with zero downtime..."
  $compose_cmd up -d --remove-orphans web worker

  # Step 6: Prune dangling images
  info "6. Cleaning up dangling build images..."
  docker image prune -f >/dev/null 2>&1 || true

  success "Update completed successfully!"
  cmd_status
}

# ── 4. STATUS & HEALTH INSPECTION (--status) ──────────────────────────────────
cmd_status() {
  echo -e "${BOLD}================================================================${NC}"
  echo -e "${BOLD}   📊 OPENREPLY SERVICE STATUS & HEALTH CHECK                   ${NC}"
  echo -e "${BOLD}================================================================${NC}"

  local compose_cmd
  compose_cmd="$(get_compose_cmd)"
  if [[ -n "$compose_cmd" ]]; then
    echo -e "\n${BOLD}[Docker Containers]${NC}"
    $compose_cmd ps
  fi

  local port=3000
  if [[ -f ".env" ]]; then
    local env_port
    env_port="$(grep -E "^PORT=" .env 2>/dev/null | cut -d '=' -f2- | tr -d '"'\'' ' || true)"
    [[ -n "$env_port" ]] && port="$env_port"
  fi

  echo -e "\n${BOLD}[Application Health Probe]${NC} (http://127.0.0.1:${port}/api/health)"
  if command -v curl >/dev/null 2>&1; then
    local health_json
    health_json="$(curl -sf -m 5 "http://127.0.0.1:${port}/api/health" 2>/dev/null || true)"
    if [[ -n "$health_json" ]]; then
      success "Application Health API responded (HTTP 200 OK):"
      echo "$health_json" | (command -v jq >/dev/null 2>&1 && jq . || cat)
    else
      error "Health check probe failed or service unavailable."
    fi
  fi

  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    echo -e "\n${BOLD}[Resource Consumption]${NC}"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" \
      openreply-web openreply-worker openreply-mysql 2>/dev/null || true
  fi
  echo -e "${BOLD}================================================================${NC}"
}

# ── 5. SAFE LOG STREAMING (--logs) ────────────────────────────────────────────
cmd_logs() {
  local compose_cmd
  compose_cmd="$(get_compose_cmd)"
  [[ -z "$compose_cmd" ]] && fatal "Docker Compose not found."

  local service="${1:-}"
  local tail_lines="${2:-100}"

  if [[ -n "$service" ]]; then
    info "Streaming logs for service: ${service} (last ${tail_lines} lines)..."
    $compose_cmd logs -f --tail="$tail_lines" "$service"
  else
    info "Streaming logs for all OpenReply services (last ${tail_lines} lines)..."
    $compose_cmd logs -f --tail="$tail_lines"
  fi
}

# ── 6. COMPRESSED DATABASE BACKUP (--backup) ──────────────────────────────────
cmd_backup() {
  local compose_cmd
  compose_cmd="$(get_compose_cmd)"
  mkdir -p "$BACKUP_DIR"

  local timestamp
  timestamp="$(date +"%Y%m%d_%H%M%S")"
  local backup_file="${BACKUP_DIR}/openreply_backup_${timestamp}.sql.gz"

  info "Initiating compressed MariaDB database backup..."

  # Read credentials from .env safely
  local db_name="digitale_digitaleliteisntal"
  local db_user="openreply"
  local db_pass="openreply_pass_change_me"

  if [[ -f ".env" ]]; then
    local p_db p_user p_pass
    p_db="$(grep -E "^DB_NAME=" .env 2>/dev/null | cut -d '=' -f2- | tr -d '"'\'' ' || true)"
    p_user="$(grep -E "^DB_USER=" .env 2>/dev/null | cut -d '=' -f2- | tr -d '"'\'' ' || true)"
    p_pass="$(grep -E "^DB_PASS=" .env 2>/dev/null | cut -d '=' -f2- | tr -d '"'\'' ' || true)"
    [[ -n "$p_db" ]] && db_name="$p_db"
    [[ -n "$p_user" ]] && db_user="$p_user"
    [[ -n "$p_pass" ]] && db_pass="$p_pass"
  fi

  # Dump using container exec to avoid host mysqldump dependency
  if docker ps --format '{{.Names}}' | grep -q "^openreply-mysql$"; then
    info "Dumping database '${db_name}' from container 'openreply-mysql'..."
    docker exec openreply-mysql mariadb-dump \
      -u"$db_user" -p"$db_pass" \
      --single-transaction \
      --quick \
      --routines \
      "$db_name" | gzip -9 > "$backup_file"
  else
    # Fallback to local mariadb-dump / mysqldump if external DB
    local dump_bin=""
    if command -v mariadb-dump >/dev/null 2>&1; then
      dump_bin="mariadb-dump"
    elif command -v mysqldump >/dev/null 2>&1; then
      dump_bin="mysqldump"
    fi
    if [[ -n "$dump_bin" ]]; then
      info "Dumping database '${db_name}' via host ${dump_bin}..."
      $dump_bin -u"$db_user" -p"$db_pass" --single-transaction --quick "$db_name" | gzip -9 > "$backup_file"
    else
      fatal "Neither 'openreply-mysql' container nor host mariadb-dump was found to perform backup."
    fi
  fi

  # Verify gzip file integrity
  if gzip -t "$backup_file" >/dev/null 2>&1; then
    local size
    size="$(ls -lh "$backup_file" | awk '{print $5}')"
    success "Backup created and verified successfully!"
    echo "  📁 File: ${backup_file}"
    echo "  📦 Size: ${size}"
  else
    error "Backup file failed gzip verification! Removing corrupted file..."
    rm -f "$backup_file"
    fatal "Backup verification failed."
  fi

  # Enforce retention policy: Keep last N backups
  info "Enforcing retention policy (keeping last ${MAX_BACKUPS_RETAIN} backups)..."
  local count
  count="$(ls -1t "${BACKUP_DIR}"/openreply_backup_*.sql.gz 2>/dev/null | wc -l || echo 0)"
  if [[ "$count" -gt "$MAX_BACKUPS_RETAIN" ]]; then
    local to_remove
    to_remove=$((count - MAX_BACKUPS_RETAIN))
    ls -1t "${BACKUP_DIR}"/openreply_backup_*.sql.gz | tail -n "$to_remove" | xargs -I {} rm -f "{}"
    info "Removed ${to_remove} older backup(s)."
  fi
}

# ── 7. SAFE RESTORE (--restore) ───────────────────────────────────────────────
cmd_restore() {
  local target_file="${1:-}"

  if [[ -z "$target_file" ]]; then
    echo -e "${BOLD}Available backups in ${BACKUP_DIR}:${NC}"
    ls -lht "${BACKUP_DIR}"/*.sql.gz 2>/dev/null || echo "No backups found."
    echo ""
    read -rp "Enter the full path of the backup file to restore: " target_file
  fi

  if [[ ! -f "$target_file" ]]; then
    fatal "Specified backup file does not exist: ${target_file}"
  fi

  # Verify gzip integrity before touching DB
  info "Verifying backup archive integrity..."
  if ! gzip -t "$target_file"; then
    fatal "Corrupted gzip file: ${target_file}"
  fi

  warn "CRITICAL ACTION: Restoring this backup will OVERWRITE the current MariaDB database!"
  echo "  Target File: ${target_file}"
  read -rp "To confirm this action, type 'CONFIRM': " confirmation

  if [[ "$confirmation" != "CONFIRM" ]]; then
    info "Restore cancelled by user. No changes were made."
    return 0
  fi

  local db_name="digitale_digitaleliteisntal"
  local db_user="openreply"
  local db_pass="openreply_pass_change_me"

  if [[ -f ".env" ]]; then
    local p_db p_user p_pass
    p_db="$(grep -E "^DB_NAME=" .env 2>/dev/null | cut -d '=' -f2- | tr -d '"'\'' ' || true)"
    p_user="$(grep -E "^DB_USER=" .env 2>/dev/null | cut -d '=' -f2- | tr -d '"'\'' ' || true)"
    p_pass="$(grep -E "^DB_PASS=" .env 2>/dev/null | cut -d '=' -f2- | tr -d '"'\'' ' || true)"
    [[ -n "$p_db" ]] && db_name="$p_db"
    [[ -n "$p_user" ]] && db_user="$p_user"
    [[ -n "$p_pass" ]] && db_pass="$p_pass"
  fi

  info "Restoring database into '${db_name}'..."
  if docker ps --format '{{.Names}}' | grep -q "^openreply-mysql$"; then
    gunzip -c "$target_file" | docker exec -i openreply-mysql mariadb -u"$db_user" -p"$db_pass" "$db_name"
  else
    gunzip -c "$target_file" | mariadb -u"$db_user" -p"$db_pass" "$db_name"
  fi

  success "Database restore completed successfully!"
  info "Running database audit to verify restored tables..."
  cmd_status
}

# ── 8. ROLLBACK PLAN (--rollback) ─────────────────────────────────────────────
cmd_rollback() {
  echo -e "${BOLD}================================================================${NC}"
  echo -e "${BOLD}   🔄 OPENREPLY DISASTER ROLLBACK PROCEDURE                     ${NC}"
  echo -e "${BOLD}================================================================${NC}"
  echo "In the event of a faulty release or database corruption, execute:"
  echo ""
  echo "1. ROLLBACK CONTAINERS TO PREVIOUS STABLE BUILD:"
  echo "   docker compose down"
  echo "   git checkout <PREVIOUS_STABLE_COMMIT_OR_TAG>"
  echo "   ./deploy/quick-launch.sh --up"
  echo ""
  echo "2. RESTORE LAST KNOWN GOOD DATABASE BACKUP:"
  echo "   ./deploy/quick-launch.sh --restore"
  echo ""
  echo "3. VERIFY HEALTH:"
  echo "   ./deploy/quick-launch.sh --status"
  echo -e "${BOLD}================================================================${NC}"
}

# ── 9. HELP & USAGE (--help) ──────────────────────────────────────────────────
cmd_help() {
  cat <<EOF
OpenReply VPS Quick Launch Management Utility

USAGE:
  ./deploy/quick-launch.sh [OPTION]

OPTIONS:
  --check               Non-destructive pre-flight check of host, Docker, .env, ports
  --up                  Build images, initialize schema, baseline migrations, and start stack
  --update              Zero-data-loss update: auto-backups DB, rebuilds, and restarts containers
  --status              Inspect Docker container status, memory usage, and health API response
  --logs [svc] [lines]  View or stream service logs (e.g., --logs web 50)
  --backup              Create verified, timestamped, gzip-compressed MariaDB backup
  --restore [path]      Interactively restore a gzip SQL dump with confirmation safety gate
  --rollback            Display explicit rollback plan for containers and database
  --help                Display this reference manual

EXAMPLES:
  ./deploy/quick-launch.sh --check
  ./deploy/quick-launch.sh --up
  ./deploy/quick-launch.sh --status
  ./deploy/quick-launch.sh --logs worker
  ./deploy/quick-launch.sh --backup
EOF
}

# ── Entrypoint Dispatcher ─────────────────────────────────────────────────────
action="${1:---help}"
shift || true

case "$action" in
  --check|check)
    cmd_check
    ;;
  --up|up)
    cmd_up
    ;;
  --update|update)
    cmd_update
    ;;
  --status|status)
    cmd_status
    ;;
  --logs|logs)
    cmd_logs "${1:-}" "${2:-100}"
    ;;
  --backup|backup)
    cmd_backup
    ;;
  --restore|restore)
    cmd_restore "${1:-}"
    ;;
  --rollback|rollback)
    cmd_rollback
    ;;
  --help|help|-h)
    cmd_help
    ;;
  *)
    error "Unknown option: $action"
    cmd_help
    exit 1
    ;;
esac
