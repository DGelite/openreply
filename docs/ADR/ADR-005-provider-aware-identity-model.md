# ADR-005: Provider-Aware Identity Model & Cross-Mapping

## Status
ACCEPTED

## Context
Instagram User Identifiers differ between Meta Graph API and Third-Party / Data Scrapers:
- Meta Graph API uses **IGSID (Instagram Scoped ID)** unique to each Facebook App/Page.
- BoxAPI Official API uses **Meta Page Scoped IDs** via its verified partner gateway.
- BoxAPI Data API uses **Global Numeric PKs** (`pk` / `pk_id`) and public Usernames (`username`).
- Instagram usernames are mutable (users can change their username at any time).

If we bind leads purely by username, a username change breaks customer history. If we bind purely by IGSID, Data API cannot resolve it without mapping.

## Decision
1. Update `CustomerIdentity` model to be Provider-Aware:
   - `primaryId`: Global system customer UUID.
   - `metaScopedId`: Optional string (Meta IGSID).
   - `boxApiScopedId`: Optional string (BoxAPI sender/recipient ID).
   - `globalInstagramId`: Optional string (Instagram numeric PK).
   - `currentUsername`: String (normalized lower-case).
   - `usernameHistory`: JSON array of previous handles.
   - `phoneNumber`: E.164 normalized Iranian mobile number.
2. An `IdentityResolverService` (`lib/identity/identity-resolver.ts`) correlates inbound events:
   - First matches on `metaScopedId` or `boxApiScopedId` (if known).
   - Then matches on `globalInstagramId`.
   - Falls back to `currentUsername`.
   - When a phone number is provided, merges profiles safely into a single canonical customer record.

## Consequences
- Clean, uncorrupted customer records across all providers and historical interactions.
