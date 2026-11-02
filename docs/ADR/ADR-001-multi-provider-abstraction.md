# ADR-001: Multi-Provider Abstraction & Contract Layer

## Status
ACCEPTED

## Context
OpenReply previously had tight coupling to the Meta Graph API client (`lib/meta/client.ts`). Introducing BoxAPI as a first-class, fully independent provider requires abstracting all Instagram operations behind a clean, type-safe interface so that:
1. Business logic (Flow Builder, Automated DM, Comment Reply, Lead Generation) remains completely agnostic of the underlying provider.
2. Multiple providers (Meta, BoxAPI, and future extensions) can be plugged in without touching workflow executors.

## Decision
We define `InstagramProvider` interface (`lib/providers/contracts/instagram-provider.interface.ts`) specifying standard contract methods:
* `sendTextMessage(accountId: string, recipientId: string, text: string, options?: MessageOptions): Promise<ProviderSendResult>`
* `sendGenericTemplate(accountId: string, recipientId: string, elements: GenericTemplateElement[]): Promise<ProviderSendResult>`
* `sendAttachment(accountId: string, recipientId: string, type: AttachmentType, url: string): Promise<ProviderSendResult>`
* `replyComment(accountId: string, commentId: string, text: string): Promise<ProviderSendResult>`
* `privateReply(accountId: string, commentId: string, text: string): Promise<ProviderSendResult>`
* `deleteComment(accountId: string, commentId: string): Promise<ProviderOperationResult>`
* `checkFollowStatus(accountId: string, customerId: string): Promise<boolean>`
* `getUserProfile(accountId: string, userId: string): Promise<NormalizedUserProfile>`
* `testConnection(accountId: string): Promise<ProviderHealthCheckResult>`

We implement two concrete classes implementing this interface:
1. `MetaProvider` (`lib/providers/meta/meta-provider.ts`): Wraps Meta Graph API v25.0 calls.
2. `BoxApiProvider` (`lib/providers/boxapi/boxapi-provider.ts`): Wraps BoxAPI Official Messaging API and BoxAPI Data API.

## Consequences
- **Positive:** Flow Builder engine and queue workers invoke only `InstagramProvider` methods. Switching between providers requires zero code changes in flow execution.
- **Negative:** Minor serialization overhead when normalizing provider-specific responses into `ProviderSendResult`.
