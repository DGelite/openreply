import { InstagramProvider } from '../contracts/instagram-provider.interface';
import {
  AttachmentType,
  MessageOptions,
  NormalizedUserProfile,
  OrchestrationMode,
  ProviderGenericElement,
  ProviderHealthCheckResult,
  ProviderOperationResult,
  ProviderSendResult,
  ProviderType,
} from '../contracts/provider-types';
import { MetaProvider } from '../meta/meta-provider';
import { BoxApiProvider } from '../boxapi/boxapi-provider';
import { ProviderError } from '../errors/provider-errors';
import { prisma } from '@/lib/db/client';

export interface CircuitState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failures: number;
  lastFailureTime?: number;
  openUntil?: number;
  probationSuccessCount: number;
}

/**
 * Smart Provider Manager
 * Central enterprise orchestrator for Meta & BoxAPI.
 * Enforces BOXAPI_PRIMARY, META_PRIMARY, and SMART_HYBRID orchestration with resilient failover & failback.
 */
export class ProviderManager implements InstagramProvider {
  public readonly providerType: ProviderType = 'META'; // Default baseline

  private readonly metaProvider: MetaProvider;
  private readonly boxApiProvider: BoxApiProvider;

  // In-memory circuit breakers per accountId and provider
  private static circuits: Map<string, CircuitState> = new Map();

  // Failback probation constants
  private static readonly FAILURE_THRESHOLD = 3;
  private static readonly CIRCUIT_COOLDOWN_MS = 60 * 1000; // 1 minute default
  private static readonly POLICY_368_COOLDOWN_MS = 60 * 60 * 1000; // 60 minutes for code 368
  private static readonly PROBATION_REQUIRED_SUCCESSES = 3;

  constructor() {
    this.metaProvider = new MetaProvider();
    this.boxApiProvider = new BoxApiProvider();
  }

  private getCircuitKey(accountId: string, provider: ProviderType): string {
    return `${accountId}:${provider}`;
  }

  private getCircuit(accountId: string, provider: ProviderType): CircuitState {
    const key = this.getCircuitKey(accountId, provider);
    let state = ProviderManager.circuits.get(key);
    if (!state) {
      state = { state: 'CLOSED', failures: 0, probationSuccessCount: 0 };
      ProviderManager.circuits.set(key, state);
    }

    // Check if open circuit has cooled down
    if (state.state === 'OPEN' && state.openUntil && Date.now() >= state.openUntil) {
      state.state = 'HALF_OPEN';
      state.probationSuccessCount = 0;
    }

    return state;
  }

  private recordSuccess(accountId: string, provider: ProviderType): void {
    const state = this.getCircuit(accountId, provider);
    if (state.state === 'HALF_OPEN') {
      state.probationSuccessCount += 1;
      if (state.probationSuccessCount >= ProviderManager.PROBATION_REQUIRED_SUCCESSES) {
        state.state = 'CLOSED';
        state.failures = 0;
        state.openUntil = undefined;
      }
    } else if (state.state === 'CLOSED') {
      state.failures = 0;
    }
  }

  private recordFailure(
    accountId: string,
    provider: ProviderType,
    error: Error | ProviderError
  ): void {
    const state = this.getCircuit(accountId, provider);
    state.failures += 1;
    state.lastFailureTime = Date.now();

    const isPolicy368 = error instanceof ProviderError && error.category === 'POLICY_368';
    const cooldown = isPolicy368 ? ProviderManager.POLICY_368_COOLDOWN_MS : ProviderManager.CIRCUIT_COOLDOWN_MS;

    if (state.failures >= ProviderManager.FAILURE_THRESHOLD || isPolicy368) {
      state.state = 'OPEN';
      state.openUntil = Date.now() + cooldown;
    }

    // Persist health log asynchronously
    prisma.providerHealthLog
      .create({
        data: {
          instagramAccountId: accountId,
          provider: provider as 'META' | 'BOXAPI',
          status: state.state === 'OPEN' ? 'CIRCUIT_OPEN' : 'DEGRADED',
          errorMessage: error.message,
          checkType: 'OUTBOUND_SEND',
        },
      })
      .catch(() => {});
  }

  /**
   * Determine primary and secondary provider for an account
   */
  public async resolveProviders(
    accountId: string,
    operation?: string
  ): Promise<{ active: InstagramProvider; fallback?: InstagramProvider; mode: OrchestrationMode }> {
    const account = await prisma.instagramAccount.findUnique({
      where: { id: accountId },
      select: {
        primaryProvider: true,
        backupProvider: true,
        orchestrationMode: true,
      },
    });

    const mode: OrchestrationMode = (account?.orchestrationMode as OrchestrationMode) || 'META_PRIMARY';

    // Mode A: BOXAPI_PRIMARY — 100% BoxAPI operations
    if (mode === 'BOXAPI_PRIMARY') {
      return { active: this.boxApiProvider, fallback: undefined, mode };
    }

    // Mode B: META_PRIMARY — Meta with BoxAPI automatic failover
    if (mode === 'META_PRIMARY') {
      const metaCircuit = this.getCircuit(accountId, 'META');
      if (metaCircuit.state === 'OPEN') {
        // Meta circuit is broken, immediately use BoxAPI as active
        return { active: this.boxApiProvider, fallback: this.metaProvider, mode };
      }
      return { active: this.metaProvider, fallback: this.boxApiProvider, mode };
    }

    // Mode C: SMART_HYBRID — Feature & Health aware
    // If operation is checkFollowStatus, BoxAPI has native support whereas Meta lacks it
    if (operation === 'checkFollowStatus') {
      return { active: this.boxApiProvider, fallback: this.metaProvider, mode };
    }

    const metaCircuit = this.getCircuit(accountId, 'META');
    const boxCircuit = this.getCircuit(accountId, 'BOXAPI');

    if (metaCircuit.state === 'CLOSED') {
      return { active: this.metaProvider, fallback: this.boxApiProvider, mode };
    } else if (boxCircuit.state === 'CLOSED') {
      return { active: this.boxApiProvider, fallback: this.metaProvider, mode };
    }

    // If both degraded, use primary configuration
    const primary = account?.primaryProvider === 'BOXAPI' ? this.boxApiProvider : this.metaProvider;
    const backup = account?.primaryProvider === 'BOXAPI' ? this.metaProvider : this.boxApiProvider;
    return { active: primary, fallback: backup, mode };
  }

  /**
   * Universal execution wrapper with automated failover and failback ledgering
   */
  private async executeWithFailover<T>(
    accountId: string,
    operationName: string,
    fn: (provider: InstagramProvider) => Promise<T>
  ): Promise<T> {
    const { active, fallback, mode } = await this.resolveProviders(accountId, operationName);

    try {
      const result = await fn(active);
      this.recordSuccess(accountId, active.providerType);
      return result;
    } catch (primaryErr: unknown) {
      const err = primaryErr as Error;
      this.recordFailure(accountId, active.providerType, err);

      // Check if fallback is eligible and available
      const isEligible =
        !(err instanceof ProviderError) || err.isFailoverEligible;

      if (!fallback || !isEligible || mode === 'BOXAPI_PRIMARY') {
        throw primaryErr;
      }

      console.warn(
        `[ProviderManager] Active provider ${active.providerType} failed on ${operationName}. Attempting failover to ${fallback.providerType}. Error: ${err.message}`
      );

      // Record failover log
      prisma.providerFailoverLog
        .create({
          data: {
            instagramAccountId: accountId,
            fromProvider: active.providerType as 'META' | 'BOXAPI',
            toProvider: fallback.providerType as 'META' | 'BOXAPI',
            reason: err.message,
            errorCategory: (err as ProviderError).category || 'OUTAGE',
            automatic: true,
          },
        })
        .catch(() => {});

      // Increment failover counter on account
      prisma.instagramAccount
        .update({
          where: { id: accountId },
          data: {
            lastFailoverAt: new Date(),
            failoverCount: { increment: 1 },
          },
        })
        .catch(() => {});

      // Execute on fallback provider
      try {
        const fallbackResult = await fn(fallback);
        this.recordSuccess(accountId, fallback.providerType);
        return fallbackResult;
      } catch (fallbackErr: unknown) {
        this.recordFailure(accountId, fallback.providerType, fallbackErr as Error);
        throw fallbackErr;
      }
    }
  }

  // ─── Standard Contract Delegations ────────────────────────────────────────

  public async sendTextMessage(
    accountId: string,
    recipientId: string,
    text: string,
    options?: MessageOptions
  ): Promise<ProviderSendResult> {
    return this.executeWithFailover(accountId, 'sendTextMessage', p =>
      p.sendTextMessage(accountId, recipientId, text, options)
    );
  }

  public async sendGenericTemplate(
    accountId: string,
    recipientId: string,
    elements: ProviderGenericElement[],
    options?: MessageOptions
  ): Promise<ProviderSendResult> {
    return this.executeWithFailover(accountId, 'sendGenericTemplate', p =>
      p.sendGenericTemplate(accountId, recipientId, elements, options)
    );
  }

  public async sendAttachment(
    accountId: string,
    recipientId: string,
    type: AttachmentType,
    url: string,
    options?: MessageOptions
  ): Promise<ProviderSendResult> {
    return this.executeWithFailover(accountId, 'sendAttachment', p =>
      p.sendAttachment(accountId, recipientId, type, url, options)
    );
  }

  public async replyComment(
    accountId: string,
    commentId: string,
    text: string
  ): Promise<ProviderSendResult> {
    return this.executeWithFailover(accountId, 'replyComment', p =>
      p.replyComment(accountId, commentId, text)
    );
  }

  public async privateReply(
    accountId: string,
    commentId: string,
    text: string,
    options?: MessageOptions
  ): Promise<ProviderSendResult> {
    return this.executeWithFailover(accountId, 'privateReply', p =>
      p.privateReply(accountId, commentId, text, options)
    );
  }

  public async deleteComment(
    accountId: string,
    commentId: string
  ): Promise<ProviderOperationResult> {
    return this.executeWithFailover(accountId, 'deleteComment', p =>
      p.deleteComment(accountId, commentId)
    );
  }

  public async hideComment(
    accountId: string,
    commentId: string,
    hide: boolean
  ): Promise<ProviderOperationResult> {
    return this.executeWithFailover(accountId, 'hideComment', p =>
      p.hideComment(accountId, commentId, hide)
    );
  }

  public async checkFollowStatus(
    accountId: string,
    customerId: string
  ): Promise<boolean> {
    return this.executeWithFailover(accountId, 'checkFollowStatus', p =>
      p.checkFollowStatus(accountId, customerId)
    );
  }

  public async getUserProfile(
    accountId: string,
    userId: string
  ): Promise<NormalizedUserProfile> {
    return this.executeWithFailover(accountId, 'getUserProfile', p =>
      p.getUserProfile(accountId, userId)
    );
  }

  public async testConnection(accountId: string): Promise<ProviderHealthCheckResult> {
    const { active } = await this.resolveProviders(accountId, 'testConnection');
    return active.testConnection(accountId);
  }
}

// Global Singleton Export
export const providerManager = new ProviderManager();
