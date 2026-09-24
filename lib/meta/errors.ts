/**
 * Meta Graph API v25.0 Custom Error Hierarchy
 */

export class MetaApiError extends Error {
  constructor(
    public code: number,
    public subcode: number | undefined,
    public fbTraceId: string | undefined,
    message: string
  ) {
    super(message);
    this.name = "MetaApiError";
  }
}

export class TokenExpiredError extends MetaApiError {
  constructor(message: string, fbTraceId?: string) {
    super(190, undefined, fbTraceId, message);
    this.name = "TokenExpiredError";
  }
}

export class RateLimitError extends MetaApiError {
  /** Suggested backoff in milliseconds, based on Meta's Retry-After or defaults. */
  public retryAfterMs: number;
  constructor(message: string, fbTraceId?: string, retryAfterMs = 60_000) {
    super(368, undefined, fbTraceId, message);
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

export class PermissionError extends MetaApiError {
  constructor(message: string, fbTraceId?: string) {
    super(100, undefined, fbTraceId, message);
    this.name = "PermissionError";
  }
}

export class PolicyBlockError extends MetaApiError {
  constructor(message: string, fbTraceId?: string) {
    super(368, undefined, fbTraceId, message);
    this.name = "PolicyBlockError";
  }
}

export class MessagingWindowExpiredError extends MetaApiError {
  constructor(subcode: number, message: string, fbTraceId?: string) {
    super(100, subcode, fbTraceId, message);
    this.name = "MessagingWindowExpiredError";
  }
}

export class CommentAlreadyRepliedError extends MetaApiError {
  constructor(message: string, fbTraceId?: string) {
    super(100, 2534015, fbTraceId, message);
    this.name = "CommentAlreadyRepliedError";
  }
}

export class UserUnreachableError extends MetaApiError {
  constructor(message: string, fbTraceId?: string) {
    super(100, 2018001, fbTraceId, message);
    this.name = "UserUnreachableError";
  }
}
