#!/usr/bin/env bash
# ==============================================================================
# OPENREPLY SAAS — VPS QUICK LAUNCH FORWARDER
# ==============================================================================
# Forwards all arguments directly to the comprehensive deploy/quick-launch.sh
# ==============================================================================
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "${SCRIPT_DIR}/../deploy/quick-launch.sh" "$@"
