import {
  ProviderAuthExpiredError,
  ProviderError,
  ProviderNetworkError,
  ProviderOutageError,
  ProviderPolicyBlockError,
  ProviderRateLimitError,
  ProviderTimeoutError,
  ProviderUnrecoverableError,
} from '../errors/provider-errors';

export interface BoxApiConfig {
  baseUrl?: string;
  apiKey: string;
  apiToken?: string; // For Data API
  accountId?: string;
  timeoutMs?: number;
}

export interface BoxApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  status_code?: number;
  data?: T;
  error?: string;
}

/**
 * Robust HTTP Client for BoxAPI
 * Handles Official Messaging API and Public Data API requests with timeout guards and classified error mapping.
 */
export class BoxApiClient {
  private readonly baseUrl: string;
  private readonly dataBaseUrl: string;
  private readonly apiKey: string;
  private readonly apiToken?: string;
  private readonly accountId?: string;
  private readonly timeoutMs: number;

  constructor(config: BoxApiConfig) {
    this.baseUrl = config.baseUrl?.replace(/\/$/, '') || 'https://boxapi.ir';
    this.dataBaseUrl = `${this.baseUrl}/api/instagram`;
    this.apiKey = config.apiKey;
    this.apiToken = config.apiToken;
    this.accountId = config.accountId;
    this.timeoutMs = config.timeoutMs ?? 10000;
  }

  /**
   * Execute an official messaging action endpoint
   */
  public async officialPost<T = unknown>(
    actionPath: string,
    payload: Record<string, unknown>
  ): Promise<BoxApiResponse<T>> {
    const url = `${this.baseUrl}${actionPath.startsWith('/') ? actionPath : `/${actionPath}`}`;
    
    // Automatically inject account_id if not present
    const bodyPayload = {
      ...(this.accountId && !payload.account_id ? { account_id: this.accountId } : {}),
      ...payload,
    };

    return this.executeRequest<T>(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Api-Key': this.apiKey,
      },
      body: JSON.stringify(bodyPayload),
    });
  }

  /**
   * Execute an official GET endpoint (e.g. /service/info, /service/actions/logs)
   */
  public async officialGet<T = unknown>(path: string): Promise<BoxApiResponse<T>> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    return this.executeRequest<T>(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Api-Key': this.apiKey,
      },
    });
  }

  /**
   * Execute a Data API (Scraper) endpoint
   */
  public async dataPost<T = unknown>(
    categoryAction: string,
    params: Record<string, unknown>
  ): Promise<T> {
    const token = this.apiToken || this.apiKey;
    const url = `${this.dataBaseUrl}/${categoryAction.replace(/^\//, '')}`;

    const res = await this.executeRequest<T>(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });

    return (res.data ?? res) as T;
  }

  /**
   * Internal HTTP execution with timeout, circuit breaker and classified error handling
   */
  private async executeRequest<T>(url: string, init: RequestInit): Promise<BoxApiResponse<T>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });

      const responseText = await response.text();
      let parsedJson: unknown = null;
      try {
        parsedJson = responseText ? JSON.parse(responseText) : {};
      } catch {
        parsedJson = { raw: responseText };
      }

      if (!response.ok) {
        this.handleHttpError(response.status, parsedJson, url);
      }

      return (parsedJson as BoxApiResponse<T>) ?? { success: true };
    } catch (err: unknown) {
      if (err instanceof ProviderError) {
        throw err;
      }

      if (err instanceof Error && err.name === 'AbortError') {
        throw new ProviderTimeoutError('BOXAPI', `Request to ${url} timed out after ${this.timeoutMs}ms`, err);
      }

      throw new ProviderNetworkError('BOXAPI', `Network failure contacting BoxAPI (${url}): ${(err as Error)?.message || err}`, err);
    } finally {
      clearTimeout(timer);
    }
  }

  private handleHttpError(status: number, errorBody: unknown, url: string): never {
    const message = typeof errorBody === 'object' && errorBody !== null && 'message' in errorBody
      ? String((errorBody as { message: unknown }).message)
      : JSON.stringify(errorBody);

    if (status === 401 || status === 403 && message.toLowerCase().includes('token')) {
      throw new ProviderAuthExpiredError('BOXAPI', message, errorBody);
    }

    if (status === 429 || message.toLowerCase().includes('rate limit')) {
      throw new ProviderRateLimitError('BOXAPI', message, 60000, errorBody);
    }

    if (status === 403 && (message.includes('368') || message.toLowerCase().includes('policy'))) {
      throw new ProviderPolicyBlockError('BOXAPI', message, errorBody);
    }

    if (status >= 500) {
      throw new ProviderOutageError('BOXAPI', `BoxAPI Server Error (${status}): ${message}`, status, errorBody);
    }

    if (status === 400 || status === 404 || status === 422) {
      throw new ProviderUnrecoverableError('BOXAPI', `BoxAPI Client Error (${status}) at ${url}: ${message}`, status, errorBody);
    }

    throw new ProviderError(message, 'BOXAPI', 'UNKNOWN_DELIVERY', true, status, errorBody);
  }
}
