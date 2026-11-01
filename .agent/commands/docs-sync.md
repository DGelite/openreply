# Agent Command: /docs-sync

> **Purpose:** Synchronize and audit repository documentation against actual code, dependencies, architecture, and deployment procedures.

## Operational Workflow

When this command is invoked, the Agent MUST execute the following cross-auditing steps:

### 1. AGENTS.md & GEMINI.md Audit
Verify that:
- `AGENTS.md` and `GEMINI.md` list all active `.agent/commands/`.
- Test counts match actual Vitest suite metrics (112+ tests).
- Supported environment targets (MariaDB 10.11+, Linux VPS, Docker) match current architecture.
- Outdated Redis references are eliminated.

### 2. README.md & Deployment Instructions Audit
Verify that:
- `README.md` reflects modern Quick Launch workflows (`deploy/quick-launch.sh`).
- Environment variables documented in `.env.example` match variables required by `lib/env.ts` and `Dockerfile`.
- Port configurations (Web 3000, MariaDB 3308 loopback proxy) are accurately explained.

### 3. Changelog Synchronization
Verify that:
- `CHANGELOG.md` documents all architectural enhancements:
  - VPS Quick Launch engine.
  - Multi-worker safe MariaDB queue (`lockedBy`, `lockedAt`, conversation serialization).
  - Production Docker orchestration with non-root user and signal forwarding.
  - Vitest test suite expansion to 112+ tests.

## Expected Output Format
The Agent must deliver:
- Documentation parity status.
- Discrepancy list (if any).
- Changes applied to synchronize docs with repository state.
