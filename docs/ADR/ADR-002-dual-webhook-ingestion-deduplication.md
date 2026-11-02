# ADR-002: Dual Webhook Ingestion, Cryptographic Verification & Deduplication

## Status
ACCEPTED

## Context
When running in Multi-Provider mode or Hot Failover, webhooks may arrive from either:
1. Meta Graph API (`/api/webhook` with `x-hub-signature-256` HMAC-SHA256).
2. BoxAPI Webhook (`/api/webhook/boxapi` with `X-BoxApi-Signature` HMAC-SHA256 of `{timestamp}.{raw_body}`).
3. Both sources simultaneously during transitional or redundancy configurations.

We must guarantee:
1. Strict cryptographic signature verification for all inbound requests.
2. 5-minute replay attack protection via timestamp verification.
3. Durable persistence before acknowledging (HTTP 200 within 3.5s).
4. Zero duplicate processing: if an event (e.g. comment or message) is delivered by both webhooks, it must be deduplicated via an atomic idempotency ledger.

## Decision
1. Create a dedicated BoxAPI webhook route: `app/api/webhook/boxapi/route.ts`.
2. Normalize all incoming raw payloads from both sources into a standard `NormalizedInboundEvent` DTO:
   - `eventType`: `COMMENT` | `DIRECT_MESSAGE` | `POSTBACK` | `REACTION` | `ECHO`
   - `idempotencyKey`: `hash(provider + "_" + accountId + "_" + itemPk)`
3. Maintain an `InboundEventLedger` in MariaDB with a `UNIQUE(idempotencyKey)` index.
4. If an insert conflicts on `idempotencyKey`, it is logged as a duplicate and safely acknowledged without enqueuing duplicate jobs.

## Consequences
- Guaranteed zero duplicate responses sent to users.
- Independent uptime and failure isolation between Meta and BoxAPI webhooks.
