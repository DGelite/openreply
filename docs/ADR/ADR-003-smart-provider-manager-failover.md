# ADR-003: Smart Provider Manager, Error Classification & Failover/Failback

## Status
ACCEPTED

## Context
A fragile failover mechanism that blindly switches providers on any error can cause thrashing (oscillating between providers), worsening rate limits or triggering duplicate messages.
A resilient failover engine must:
1. Classify errors intelligently (Network timeout vs Auth failure vs Policy 368 vs Rate Limit).
2. Avoid blind retries on unknown delivery states (prevent duplicate DMs).
3. Enforce a stable Failback policy with a configurable cooldown period (e.g. 15 minutes of consecutive healthy checks before returning to Primary).

## Decision
1. Implement `ProviderManager` (`lib/providers/manager/provider-manager.ts`).
2. Error Classification Hierarchy (`lib/providers/errors/provider-errors.ts`):
   - `TransitiveNetworkError`: Eligible for retry with exponential backoff on current provider.
   - `RateLimitExceeded`: Immediately pause current provider; failover to secondary provider if available.
   - `PolicyBlockError (Code 368)`: Trip circuit breaker for 60 minutes on current provider; failover.
   - `AuthenticationExpiredError`: Trip circuit breaker until credential update; failover.
   - `UnrecoverablePayloadError` (e.g. invalid recipient ID): Abort; do NOT failover.
   - `UnknownDeliveryStatus`: Query provider message log before retrying to prevent duplicate sends.
3. Provider Health Telemetry:
   - Tracks consecutive successes, consecutive failures, latency, and circuit state (`CLOSED`, `OPEN`, `HALF_OPEN`).
4. Stable Failback:
   - When Primary is `OPEN`, system routes to Backup.
   - Transition to `HALF_OPEN` requires a configurable probation window (`FAILBACK_PROBATION_MINUTES`, default 10m) and 3 consecutive successful synthetic ping/probe tests.

## Consequences
- High availability with zero thrashing.
- Comprehensive telemetry visible in Admin dashboard.
