# ADR-004: Zero-Lead-Loss Reconciliation Worker via BoxAPI Data API

## Status
ACCEPTED

## Context
Webhooks are subject to transient network failures, server restarts, or Meta/BoxAPI delivery interruptions. If an Instagram user comments on a post while the server or webhook is down, that comment event is lost unless recovered.
To fulfill the non-negotiable invariant of **Zero Lead Loss**, we cannot rely solely on push webhooks.

## Decision
1. Implement a dedicated `ReconciliationWorker` (`worker/reconciliation-worker.ts`) and client (`lib/reconciliation/reconciliation-engine.ts`).
2. The worker operates periodically (every 5 minutes or on demand upon system recovery):
   - For each active account, it fetches the recent 5 posts/reels.
   - For each post, it queries BoxAPI Data API: `POST /api/instagram/media/get_comments`.
   - BoxAPI Data API queries public Instagram servers directly without depending on active webhooks or page tokens.
   - For every retrieved comment, the worker checks `InboundEventLedger` or `Lead` table.
   - If the comment ID does not exist in our database:
     * It marks it as `MISSED_INBOUND_EVENT`.
     * Records it into the ledger.
     * Enqueues a high-priority job into the MariaDB queue to extract phone numbers, trigger lead capture, and notify CRM.

## Consequences
- Guaranteed mathematical recovery of lost leads even after hours of server outage.
- Minimal BoxAPI credit usage (scanning 5 posts consumes ~5 credits per cycle).
