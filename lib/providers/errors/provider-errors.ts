/**
 * Classified Provider Errors Hierarchy
 * Distinguishes transient network errors from authentication, policy, rate limits, and unrecoverable payload errors.
 */

export type ErrorCategory =
  | 'AUTH_EXPIRED'
  | 'RATE_LIMIT'
  | 'POLICY_368'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'PROVIDER_OUTAGE'
  | 'UNRECOVERABLE_PAYLOAD'
  | 'UNKNOWN_DELIVERY';

export class ProviderError extends Error {
  public readonly provider: string;
  public readonly category: ErrorCategory;
  public readonly statusCode?: number;
  public readonly rawError?: unknown;
  public readonly isFailoverEligible: boolean;

  constructor(
    message: string,
    provider: string,
    category: ErrorCategory,
    isFailoverEligible: boolean,
    statusCode?: number,
    rawError?: unknown
  ) {
    super(`[${provider}] [${category}] ${message}`);
    this.name = 'ProviderError';
    this.provider = provider;
    this.category = category;
    this.isFailoverEligible = isFailoverEligible;
    this.statusCode = statusCode;
    this.rawError = rawError;
  }
}

export class ProviderAuthExpiredError extends ProviderError {
  constructor(provider: string, message = 'Token or API credentials expired/invalid', rawError?: unknown) {
    super(message, provider, 'AUTH_EXPIRED', true, 401, rawError);
    this.name = 'ProviderAuthExpiredError';
  }
}

export class ProviderRateLimitError extends ProviderError {
  public readonly retryAfterMs: number;
  constructor(provider: string, message = 'Rate limit exceeded', retryAfterMs = 60000, rawError?: unknown) {
    super(message, provider, 'RATE_LIMIT', true, 429, rawError);
    this.name = 'ProviderRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class ProviderPolicyBlockError extends ProviderError {
  constructor(provider: string, message = 'Policy restriction or Code 368 PolicyBlock triggered', rawError?: unknown) {
    super(message, provider, 'POLICY_368', true, 403, rawError);
    this.name = 'ProviderPolicyBlockError';
  }
}

export class ProviderTimeoutError extends ProviderError {
  constructor(provider: string, message = 'Request timed out waiting for provider response', rawError?: unknown) {
    super(message, provider, 'TIMEOUT', true, 504, rawError);
    this.name = 'ProviderTimeoutError';
  }
}

export class ProviderNetworkError extends ProviderError {
  constructor(provider: string, message = 'Network connection failure or unreachable host', rawError?: unknown) {
    super(message, provider, 'NETWORK_ERROR', true, 502, rawError);
    this.name = 'ProviderNetworkError';
  }
}

export class ProviderOutageError extends ProviderError {
  constructor(provider: string, message = 'Provider returned 5xx server error', statusCode = 500, rawError?: unknown) {
    super(message, provider, 'PROVIDER_OUTAGE', true, statusCode, rawError);
    this.name = 'ProviderOutageError';
  }
}

export class ProviderUnrecoverableError extends ProviderError {
  constructor(provider: string, message: string, statusCode = 400, rawError?: unknown) {
    super(message, provider, 'UNRECOVERABLE_PAYLOAD', false, statusCode, rawError);
    this.name = 'ProviderUnrecoverableError';
  }
}
