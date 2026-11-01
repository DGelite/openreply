---
trigger: always_on
description: "Core architectural invariants, Next.js 16 App Router standards, and non-negotiables for OpenReply."
---

# OpenReply Core Architectural Rules

> **Project AGENTS.md:** [`AGENTS.md`](file:///I:/Desktop/openreply-main/AGENTS.md)  
> **Ecosystem Constitution:** [`C:/wamp64/www/docs/ENGINEERING-CONSTITUTION.md`](file:///C:/wamp64/www/docs/ENGINEERING-CONSTITUTION.md)  
> **Vitest Suite:** `npx vitest run` (78 passing tests)

---

## 1. Architectural Boundaries
* OpenReply is a standalone Next.js 16 SaaS application.
* It must never perform direct filesystem traversals to Booking or MiniApp.
* Database operations are strictly constrained to `digitale_digitaleliteisntal` via Prisma ORM.

## 2. Portability & Configuration
* Booking API endpoints, HMAC signing secrets, Redis connection strings, and Meta App IDs must be loaded from `.env`, never hardcoded.
* Deployment must work seamlessly whether OpenReply runs on the same Docker host or a separate server.
