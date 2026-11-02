/**
 * OpenReply Multi-Provider Types & Data Transfer Objects
 */

export type ProviderType = 'META' | 'BOXAPI';
export type OrchestrationMode = 'BOXAPI_PRIMARY' | 'META_PRIMARY' | 'SMART_HYBRID';

export interface ProviderButton {
  type: 'postback' | 'web_url';
  title: string;
  url?: string;
  payload?: string;
}

export interface ProviderQuickReply {
  content_type: 'text';
  title: string;
  payload: string;
}

export interface ProviderGenericElement {
  title: string;
  subtitle?: string;
  image_url?: string;
  default_action?: {
    type: 'web_url';
    url: string;
  };
  buttons?: ProviderButton[];
}

export interface MessageOptions {
  buttons?: ProviderButton[];
  quick_replies?: ProviderQuickReply[];
  tag?: string;
  idempotencyKey?: string;
}

export interface ProviderSendResult {
  success: boolean;
  provider: ProviderType;
  messageId?: string;
  recipientId: string;
  status: 'SENT' | 'FAILED' | 'UNKNOWN';
  statusCode?: number;
  error?: string;
  errorCode?: string;
  rawResponse?: unknown;
  timestamp: Date;
}

export interface ProviderOperationResult {
  success: boolean;
  provider: ProviderType;
  operation: string;
  targetId?: string;
  error?: string;
  statusCode?: number;
  rawResponse?: unknown;
}

export interface NormalizedUserProfile {
  id: string; // provider scoped or numeric PK
  username?: string;
  name?: string;
  profilePic?: string;
  followerCount?: number;
  isFollower?: boolean;
  isPrivate?: boolean;
}

export interface ProviderHealthCheckResult {
  provider: ProviderType;
  healthy: boolean;
  latencyMs: number;
  statusCode?: number;
  accountConnected: boolean;
  error?: string;
  quotaRemaining?: number | string;
  details?: Record<string, unknown>;
}

export type AttachmentType = 'image' | 'file' | 'voice' | 'video';
