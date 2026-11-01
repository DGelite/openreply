<div align="center">

# OpenReply

Open-source Instagram comment-to-DM automation & AI reply engine.

[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg)](LICENSE)
[![Built with Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org)
[![Database: MariaDB](https://img.shields.io/badge/Database-MariaDB_10.11-blue.svg)](https://mariadb.org)
[![Meta Graph API](https://img.shields.io/badge/Meta_API-v25.0-blue.svg)](https://developers.facebook.com)
[![Tests Passing](https://img.shields.io/badge/Tests-112%20passing-brightgreen.svg)](__tests__)

</div>

Someone comments `PRICE` or `LINK` on your reel, and they get a DM with your link or answers a second later. OpenReply watches comments on your Instagram posts, and when a comment matches your keywords, it sends that user a private reply through the official Meta Graph API v25.0. It also supports optional public comment replies, AI-powered conversational smart responses, drip campaigns, and lead capture.

Self-hosted, free, running on your own infrastructure, with no seat limits and no artificial plan caps.

---

## Features

- **Keyword to DM:** Match one or many keywords per post, with Persian & Arabic normalization and slang support.
- **Optional Public Reply:** Post a visible comment reply alongside the private DM.
- **AI Smart Replies:** Google Gemini & OpenAI integration for dynamic intent recognition and context-aware responses.
- **Visual Flow Builder:** Drag-and-drop interactive flow canvas powered by `@xyflow/react`.
- **CRM & Booking Mesh:** Resilient bi-directional sync with PHP Booking CRM via circuit-broken SDK.
- **Drip Campaigns:** Scheduled follow-up sequences strictly respecting Meta's 24-hour messaging policy.
- **Meta v25.0 Anti-Ban Circuit Breaker:** Automatic cool-off protection against Meta code 368 rate-limit flags.
- **High-Throughput MariaDB Queue:** Fully transactional queue engine (`BackgroundJob`). Zero Redis dependency.
- **Tracked Links & Analytics:** Real-time click tracking and CTR analytics for campaign links.

---

## Tech Stack

- **Framework:** Next.js 16.2.6 (App Router) & React 19.2.4
- **Language:** TypeScript 5
- **Database & ORM:** MariaDB 10.11+ / MySQL with Prisma ORM 7.9 (`@prisma/adapter-mariadb`)
- **Queue Engine:** MySQL-backed concurrent queue (`lib/queue/mysql-queue.ts`)
- **Authentication:** NextAuth v5 with role-based access control (`SUPER_ADMIN`, `ADMIN`, `MEMBER`)
- **Containerization:** Multi-stage Dockerfile (`node:20-alpine`, non-root user `nextjs`, `tini`)

---

## Local Development

### Prerequisites
- Node.js 20+ (LTS)
- Local MariaDB / MySQL server (e.g. WampServer or native service)

### Steps
```bash
git clone https://github.com/diwenne/openreply.git
cd openreply
npm install

# 1. Configure environment variables
cp .env.example .env
# Edit .env and set DATABASE_URL (e.g. mysql://root:@127.0.0.1:3306/digitale_digitaleliteisntal)

# 2. Run automated pre-flight audit
npm run check

# 3. Synchronize database baseline migrations
npm run db:baseline

# 4. Start development web server
npm run dev

# 5. (Optional) Run dedicated background worker in separate terminal
npm run worker
```

---

## Linux VPS Quick Launch (Production)

Deploying to an Ubuntu/Debian Linux VPS with Docker Engine takes 2 minutes:

```bash
# 1. Clone repository
git clone https://github.com/diwenne/openreply.git
cd openreply

# 2. Setup production environment
cp .env.example .env
nano .env

# 3. Pre-flight check
./deploy/quick-launch.sh --check

# 4. Launch entire stack (Web, Worker, MariaDB)
./deploy/quick-launch.sh --up

# 5. Verify status and health probe
./deploy/quick-launch.sh --status
```

### Quick Launch Commands Reference

```bash
./deploy/quick-launch.sh --check    # Audit host, docker, .env, ports
./deploy/quick-launch.sh --up       # Build images, baseline database, and start containers
./deploy/quick-launch.sh --update   # Zero-data-loss update with automated pre-backup
./deploy/quick-launch.sh --status   # Check container status and /api/health probe
./deploy/quick-launch.sh --logs     # Stream logs (e.g., ./deploy/quick-launch.sh --logs worker)
./deploy/quick-launch.sh --backup   # Create timestamped, compressed MariaDB backup
./deploy/quick-launch.sh --restore  # Safely restore backup with interactive confirmation
./deploy/quick-launch.sh --rollback # Display disaster recovery rollback instructions
```

---

## Testing & Quality Assurance

```bash
# Type check with zero errors
npm run typecheck

# Run full Vitest suite (112 tests across 10 test suites)
npx vitest run

# Run code governance rules check
node scripts/governance_check.mjs

# Build production bundle
npm run build
```

---

## Documentation

- [VPS Quick Launch Guide](docs/vps-quick-launch.md) — Comprehensive beginner-friendly VPS setup, Nginx reverse proxy, and SSL.
- [Database & Migrations Guide](docs/database-migration.md) — MariaDB baseline synchronization and Prisma schema workflow.
- [Backup & Disaster Recovery](docs/backup-restore.md) — Automated database dumps, retention rules, and restore safety gates.
- [Meta App Setup & Permissions](docs/setup.md) — Meta Developer Portal, Webhooks, and permissions configuration.

---

## License

MIT License. See [LICENSE](LICENSE).
