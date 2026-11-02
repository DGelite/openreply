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
import * as metaClient from '@/lib/meta/client';
import { safeDecryptToken } from '@/lib/meta/oauth';
import { prisma } from '@/lib/db/client';
import {
  ProviderAuthExpiredError,
  ProviderError,
  ProviderPolicyBlockError,
  ProviderRateLimitError,
} from '../errors/provider-errors';

export class MetaProvider implements InstagramProvider {
  public readonly providerType: ProviderType = 'META';

  private async getAccount(accountId: string) {
    const account = await prisma.instagramAccount.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        instagramId: true,
        accessToken: true,
        tokenExpiresAt: true,
      },
    });

    if (!account) {
      throw new ProviderError(
        `InstagramAccount not found for id ${accountId}`,
        'META',
        'ACCOUNT_NOT_FOUND' as any,
        false
      );
    }

    if (!account.accessToken) {
      throw new ProviderAuthExpiredError(
        'META',
        `No Meta access token configured for account ${accountId}`
      );
    }

    let decryptedToken: string;
    try {
      decryptedToken = safeDecryptToken(account.accessToken);
    } catch (e) {
      throw new ProviderAuthExpiredError(
        'META',
        `Failed to decrypt Meta access token for account ${accountId}`,
        e
      );
    }

    return { ...account, decryptedToken };
  }

  private mapMetaError(err: unknown): Error {
    if (err instanceof metaClient.PolicyBlockError) {
      return new ProviderPolicyBlockError('META', err.message, err);
    }
    if (err instanceof metaClient.RateLimitError) {
      return new ProviderRateLimitError('META', err.message, err.retryAfterMs, err);
    }
    if (err instanceof metaClient.TokenExpiredError) {
      return new ProviderAuthExpiredError('META', err.message, err);
    }
    if (err instanceof ProviderError) {
      return err;
    }
    return err as Error;
  }

  public async sendTextMessage(
    accountId: string,
    recipientId: string,
    text: string,
    options?: MessageOptions
  ): Promise<ProviderSendResult> {
    const account = await this.getAccount(accountId);

    try {
      let res: { message_id?: string; recipient_id?: string };

      if (options?.quick_replies && options.quick_replies.length > 0) {
        res = await metaClient.sendDirectQuickReplies(
          account.decryptedToken,
          account.instagramId,
          recipientId,
          text,
          options.quick_replies.map(qr => ({
            content_type: 'text' as const,
            title: qr.title,
            payload: qr.payload,
          }))
        );
      } else if (options?.buttons && options.buttons.length > 0) {
        if (options.buttons.length === 1 && options.buttons[0].type === 'web_url') {
          res = await metaClient.sendDirectMessageWithLinkButton(
            account.decryptedToken,
            account.instagramId,
            recipientId,
            text,
            options.buttons[0].title,
            options.buttons[0].url || '#'
          );
        } else {
          res = await metaClient.sendDirectMessageWithMultipleButtons(
            account.decryptedToken,
            account.instagramId,
            recipientId,
            text,
            options.buttons.map(b => ({
              type: b.type === 'web_url' ? ('web_url' as const) : ('postback' as const),
              title: b.title,
              url: b.url,
              payload: b.payload,
            }))
          );
        }
      } else {
        res = await metaClient.sendDirectMessage(
          account.decryptedToken,
          account.instagramId,
          recipientId,
          text
        );
      }

      return {
        success: true,
        provider: 'META',
        messageId: res.message_id || `meta_${Date.now()}`,
        recipientId,
        status: 'SENT',
        statusCode: 200,
        rawResponse: res,
        timestamp: new Date(),
      };
    } catch (err: unknown) {
      const mapped = this.mapMetaError(err);
      if (mapped instanceof ProviderError && mapped.isFailoverEligible) {
        throw mapped;
      }
      return {
        success: false,
        provider: 'META',
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
    const account = await this.getAccount(accountId);

    try {
      const metaElements = elements.map(el => ({
        title: el.title,
        subtitle: el.subtitle,
        image_url: el.image_url,
        default_action: el.default_action
          ? {
              type: 'web_url' as const,
              url: el.default_action.url,
            }
          : undefined,
        buttons: el.buttons?.map(b => ({
          type: b.type === 'web_url' ? ('web_url' as const) : ('postback' as const),
          title: b.title,
          url: b.url,
          payload: b.payload,
        })),
      }));

      const res = await metaClient.sendDirectGenericTemplate(
        account.decryptedToken,
        account.instagramId,
        recipientId,
        metaElements
      );

      return {
        success: true,
        provider: 'META',
        messageId: res.message_id || `meta_tpl_${Date.now()}`,
        recipientId,
        status: 'SENT',
        statusCode: 200,
        rawResponse: res,
        timestamp: new Date(),
      };
    } catch (err: unknown) {
      const mapped = this.mapMetaError(err);
      if (mapped instanceof ProviderError && mapped.isFailoverEligible) {
        throw mapped;
      }
      return {
        success: false,
        provider: 'META',
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
    const account = await this.getAccount(accountId);

    try {
      const mediaType: 'image' | 'video' | 'audio' =
        type === 'voice' ? 'audio' : type === 'file' ? 'image' : type;

      const res = await metaClient.sendDirectMediaMessage(
        account.decryptedToken,
        account.instagramId,
        recipientId,
        mediaType,
        url
      );

      return {
        success: true,
        provider: 'META',
        messageId: res.message_id || `meta_att_${Date.now()}`,
        recipientId,
        status: 'SENT',
        statusCode: 200,
        rawResponse: res,
        timestamp: new Date(),
      };
    } catch (err: unknown) {
      const mapped = this.mapMetaError(err);
      if (mapped instanceof ProviderError && mapped.isFailoverEligible) {
        throw mapped;
      }
      return {
        success: false,
        provider: 'META',
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
    const account = await this.getAccount(accountId);

    try {
      const res = await metaClient.sendCommentReply(
        account.decryptedToken,
        commentId,
        text
      );

      return {
        success: true,
        provider: 'META',
        messageId: res.id || commentId,
        recipientId: commentId,
        status: 'SENT',
        statusCode: 200,
        rawResponse: res,
        timestamp: new Date(),
      };
    } catch (err: unknown) {
      const mapped = this.mapMetaError(err);
      if (mapped instanceof ProviderError && mapped.isFailoverEligible) {
        throw mapped;
      }
      return {
        success: false,
        provider: 'META',
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
    const account = await this.getAccount(accountId);

    try {
      let res: { message_id?: string; recipient_id?: string };

      if (options?.buttons && options.buttons.length > 0) {
        const firstBtn = options.buttons[0];
        if (firstBtn.type === 'web_url') {
          res = await metaClient.sendPrivateReplyWithLinkButton(
            account.decryptedToken,
            account.instagramId,
            commentId,
            text,
            firstBtn.title,
            firstBtn.url || '#'
          );
        } else {
          res = await metaClient.sendPrivateReplyWithButton(
            account.decryptedToken,
            account.instagramId,
            commentId,
            text,
            firstBtn.title,
            firstBtn.payload || ''
          );
        }
      } else {
        res = await metaClient.sendPrivateReply(
          account.decryptedToken,
          account.instagramId,
          commentId,
          text
        );
      }

      return {
        success: true,
        provider: 'META',
        messageId: res.message_id || `meta_pr_${Date.now()}`,
        recipientId: commentId,
        status: 'SENT',
        statusCode: 200,
        rawResponse: res,
        timestamp: new Date(),
      };
    } catch (err: unknown) {
      const mapped = this.mapMetaError(err);
      if (mapped instanceof ProviderError && mapped.isFailoverEligible) {
        throw mapped;
      }
      return {
        success: false,
        provider: 'META',
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
    const account = await this.getAccount(accountId);

    try {
      const res = await metaClient.deleteComment(account.decryptedToken, commentId);
      return {
        success: res.success,
        provider: 'META',
        operation: 'DELETE_COMMENT',
        targetId: commentId,
        rawResponse: res,
      };
    } catch (err: unknown) {
      return {
        success: false,
        provider: 'META',
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
    const account = await this.getAccount(accountId);

    try {
      const res = await metaClient.hideComment(account.decryptedToken, commentId, hide);
      return {
        success: res.success,
        provider: 'META',
        operation: hide ? 'HIDE_COMMENT' : 'UNHIDE_COMMENT',
        targetId: commentId,
        rawResponse: res,
      };
    } catch (err: unknown) {
      return {
        success: false,
        provider: 'META',
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
    // Meta Graph API does not provide a direct follower check endpoint
    return false;
  }

  public async getUserProfile(
    accountId: string,
    userId: string
  ): Promise<NormalizedUserProfile> {
    const account = await this.getAccount(accountId);

    try {
      const userInfo = await metaClient.getUserInfo(account.decryptedToken);
      return {
        id: userInfo.id,
        username: userInfo.username,
        name: userInfo.name,
        profilePic: userInfo.profile_picture_url,
      };
    } catch {
      return { id: userId };
    }
  }

  public async testConnection(accountId: string): Promise<ProviderHealthCheckResult> {
    const start = Date.now();
    try {
      const account = await this.getAccount(accountId);
      const userInfo = await metaClient.getUserInfo(account.decryptedToken);

      return {
        provider: 'META',
        healthy: true,
        latencyMs: Date.now() - start,
        statusCode: 200,
        accountConnected: Boolean(userInfo.id),
        details: { id: userInfo.id, username: userInfo.username },
      };
    } catch (err: unknown) {
      return {
        provider: 'META',
        healthy: false,
        latencyMs: Date.now() - start,
        accountConnected: false,
        error: (err as Error)?.message,
      };
    }
  }
}
