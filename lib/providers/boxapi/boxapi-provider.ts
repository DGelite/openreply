import { InstagramProvider } from '../contracts/instagram-provider.interface';
import {
  AttachmentType,
  MessageOptions,
  NormalizedUserProfile,
  ProviderGenericElement,
  ProviderHealthCheckResult,
  ProviderOperationResult,
  ProviderSendResult,
  ProviderType,
} from '../contracts/provider-types';
import { BoxApiClient, BoxApiConfig } from './boxapi-client';
import { prisma } from '@/lib/db/client';

export class BoxApiProvider implements InstagramProvider {
  public readonly providerType: ProviderType = 'BOXAPI';

  /**
   * Helper to resolve credentials for an account from DB or config
   */
  private async getClient(accountId: string): Promise<BoxApiClient> {
    const account = await prisma.instagramAccount.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        boxApiKey: true,
        boxApiToken: true,
        boxAccountId: true,
      },
    });

    const apiKey = account?.boxApiKey || process.env.BOXAPI_API_KEY || '';
    const apiToken = account?.boxApiToken || process.env.BOXAPI_API_TOKEN || apiKey;
    const boxAccountId = account?.boxAccountId || process.env.BOXAPI_ACCOUNT_ID;

    return new BoxApiClient({
      apiKey,
      apiToken,
      accountId: boxAccountId,
      baseUrl: process.env.BOXAPI_BASE_URL || 'https://boxapi.ir',
      timeoutMs: Number(process.env.BOXAPI_TIMEOUT_MS) || 10000,
    });
  }

  public async sendTextMessage(
    accountId: string,
    recipientId: string,
    text: string,
    options?: MessageOptions
  ): Promise<ProviderSendResult> {
    const client = await this.getClient(accountId);
    const payload: Record<string, unknown> = {
      recipient_id: recipientId,
      message: text,
    };

    if (options?.buttons && options.buttons.length > 0) {
      payload.buttons = options.buttons;
    }

    if (options?.quick_replies && options.quick_replies.length > 0) {
      payload.quick_replies = options.quick_replies;
    }

    const start = Date.now();
    try {
      const response = await client.officialPost<{ message_id?: string; recipient_id?: string }>(
        '/service/actions/send_message',
        payload
      );

      return {
        success: true,
        provider: 'BOXAPI',
        messageId: response.data?.message_id || `box_${Date.now()}`,
        recipientId,
        status: 'SENT',
        statusCode: response.status_code || 200,
        rawResponse: response,
        timestamp: new Date(),
      };
    } catch (err: unknown) {
      return {
        success: false,
        provider: 'BOXAPI',
        recipientId,
        status: 'FAILED',
        error: (err as Error)?.message,
        rawResponse: err,
        timestamp: new Date(),
      };
    }
  }

  public async sendGenericTemplate(
    accountId: string,
    recipientId: string,
    elements: ProviderGenericElement[],
    options?: MessageOptions
  ): Promise<ProviderSendResult> {
    const client = await this.getClient(accountId);
    const payload = {
      recipient_id: recipientId,
      elements,
    };

    try {
      const response = await client.officialPost<{ message_id?: string }>(
        '/service/actions/send_generic_template',
        payload
      );

      return {
        success: true,
        provider: 'BOXAPI',
        messageId: response.data?.message_id || `box_tpl_${Date.now()}`,
        recipientId,
        status: 'SENT',
        statusCode: response.status_code || 200,
        rawResponse: response,
        timestamp: new Date(),
      };
    } catch (err: unknown) {
      return {
        success: false,
        provider: 'BOXAPI',
        recipientId,
        status: 'FAILED',
        error: (err as Error)?.message,
        rawResponse: err,
        timestamp: new Date(),
      };
    }
  }

  public async sendAttachment(
    accountId: string,
    recipientId: string,
    type: AttachmentType,
    url: string,
    options?: MessageOptions
  ): Promise<ProviderSendResult> {
    const client = await this.getClient(accountId);

    try {
      let endpoint = '/service/actions/send_attachment';
      let payload: Record<string, unknown> = {
        recipient_id: recipientId,
        attachment_type: type,
        url,
      };

      if (type === 'image') {
        endpoint = '/service/actions/send_image';
        payload = { recipient_id: recipientId, url };
      }

      const response = await client.officialPost<{ message_id?: string }>(endpoint, payload);

      return {
        success: true,
        provider: 'BOXAPI',
        messageId: response.data?.message_id || `box_att_${Date.now()}`,
        recipientId,
        status: 'SENT',
        statusCode: response.status_code || 200,
        rawResponse: response,
        timestamp: new Date(),
      };
    } catch (err: unknown) {
      return {
        success: false,
        provider: 'BOXAPI',
        recipientId,
        status: 'FAILED',
        error: (err as Error)?.message,
        rawResponse: err,
        timestamp: new Date(),
      };
    }
  }

  public async replyComment(
    accountId: string,
    commentId: string,
    text: string
  ): Promise<ProviderSendResult> {
    const client = await this.getClient(accountId);

    try {
      const response = await client.officialPost<{ comment_id?: string }>(
        '/service/actions/reply_comment',
        {
          comment_id: commentId,
          message: text,
        }
      );

      return {
        success: true,
        provider: 'BOXAPI',
        messageId: response.data?.comment_id || commentId,
        recipientId: commentId,
        status: 'SENT',
        statusCode: response.status_code || 200,
        rawResponse: response,
        timestamp: new Date(),
      };
    } catch (err: unknown) {
      return {
        success: false,
        provider: 'BOXAPI',
        recipientId: commentId,
        status: 'FAILED',
        error: (err as Error)?.message,
        rawResponse: err,
        timestamp: new Date(),
      };
    }
  }

  public async privateReply(
    accountId: string,
    commentId: string,
    text: string,
    options?: MessageOptions
  ): Promise<ProviderSendResult> {
    const client = await this.getClient(accountId);

    try {
      const response = await client.officialPost<{ message_id?: string }>(
        '/service/actions/private_reply',
        {
          comment_id: commentId,
          message: text,
        }
      );

      return {
        success: true,
        provider: 'BOXAPI',
        messageId: response.data?.message_id || `box_pr_${Date.now()}`,
        recipientId: commentId,
        status: 'SENT',
        statusCode: response.status_code || 200,
        rawResponse: response,
        timestamp: new Date(),
      };
    } catch (err: unknown) {
      return {
        success: false,
        provider: 'BOXAPI',
        recipientId: commentId,
        status: 'FAILED',
        error: (err as Error)?.message,
        rawResponse: err,
        timestamp: new Date(),
      };
    }
  }

  public async deleteComment(
    accountId: string,
    commentId: string
  ): Promise<ProviderOperationResult> {
    const client = await this.getClient(accountId);

    try {
      const response = await client.officialPost('/service/actions/delete_comment', {
        comment_id: commentId,
      });

      return {
        success: true,
        provider: 'BOXAPI',
        operation: 'DELETE_COMMENT',
        targetId: commentId,
        rawResponse: response,
      };
    } catch (err: unknown) {
      return {
        success: false,
        provider: 'BOXAPI',
        operation: 'DELETE_COMMENT',
        targetId: commentId,
        error: (err as Error)?.message,
      };
    }
  }

  public async hideComment(
    accountId: string,
    commentId: string,
    hide: boolean
  ): Promise<ProviderOperationResult> {
    const client = await this.getClient(accountId);

    try {
      const response = await client.officialPost('/service/actions/comment-show-hide', {
        comment_id: commentId,
        hide,
      });

      return {
        success: true,
        provider: 'BOXAPI',
        operation: hide ? 'HIDE_COMMENT' : 'UNHIDE_COMMENT',
        targetId: commentId,
        rawResponse: response,
      };
    } catch (err: unknown) {
      return {
        success: false,
        provider: 'BOXAPI',
        operation: hide ? 'HIDE_COMMENT' : 'UNHIDE_COMMENT',
        targetId: commentId,
        error: (err as Error)?.message,
      };
    }
  }

  public async checkFollowStatus(
    accountId: string,
    customerId: string
  ): Promise<boolean> {
    const client = await this.getClient(accountId);

    try {
      const response = await client.officialPost<{ is_following?: boolean; status?: boolean }>(
        '/service/actions/follow_status',
        {
          customer_id: customerId,
        }
      );

      return Boolean(response.data?.is_following ?? response.data?.status ?? false);
    } catch {
      return false;
    }
  }

  public async getUserProfile(
    accountId: string,
    userId: string
  ): Promise<NormalizedUserProfile> {
    const client = await this.getClient(accountId);

    try {
      const response = await client.officialPost<{
        user?: {
          id?: string;
          username?: string;
          name?: string;
          profile_pic?: string;
          follower_count?: number;
        };
      }>('/service/actions/show_profile', {
        sender_id: userId,
      });

      const user = response.data?.user;
      return {
        id: user?.id || userId,
        username: user?.username,
        name: user?.name,
        profilePic: user?.profile_pic,
        followerCount: user?.follower_count,
      };
    } catch {
      return { id: userId };
    }
  }

  public async testConnection(accountId: string): Promise<ProviderHealthCheckResult> {
    const start = Date.now();
    try {
      const client = await this.getClient(accountId);
      const res = await client.officialGet<{
        user?: { id?: string; email?: string };
        status?: string;
      }>('/service/info');

      const latencyMs = Date.now() - start;
      return {
        provider: 'BOXAPI',
        healthy: true,
        latencyMs,
        statusCode: 200,
        accountConnected: Boolean(res.data?.user?.id),
        details: res.data as Record<string, unknown>,
      };
    } catch (err: unknown) {
      return {
        provider: 'BOXAPI',
        healthy: false,
        latencyMs: Date.now() - start,
        accountConnected: false,
        error: (err as Error)?.message,
      };
    }
  }
}
