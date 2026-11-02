import {
  AttachmentType,
  MessageOptions,
  NormalizedUserProfile,
  ProviderGenericElement,
  ProviderHealthCheckResult,
  ProviderOperationResult,
  ProviderSendResult,
  ProviderType,
} from './provider-types';

/**
 * Universal Instagram Provider Interface
 * All concrete providers (Meta, BoxAPI) MUST implement this standard contract.
 */
export interface InstagramProvider {
  readonly providerType: ProviderType;

  /**
   * Send a direct text message, optionally with inline buttons or quick replies
   */
  sendTextMessage(
    accountId: string,
    recipientId: string,
    text: string,
    options?: MessageOptions
  ): Promise<ProviderSendResult>;

  /**
   * Send generic slide cards / product carousel template
   */
  sendGenericTemplate(
    accountId: string,
    recipientId: string,
    elements: ProviderGenericElement[],
    options?: MessageOptions
  ): Promise<ProviderSendResult>;

  /**
   * Send an attachment (image, voice, file, video)
   */
  sendAttachment(
    accountId: string,
    recipientId: string,
    type: AttachmentType,
    url: string,
    options?: MessageOptions
  ): Promise<ProviderSendResult>;

  /**
   * Reply publicly to a user's comment
   */
  replyComment(
    accountId: string,
    commentId: string,
    text: string
  ): Promise<ProviderSendResult>;

  /**
   * Send a direct message in response to a public comment (Private Reply)
   */
  privateReply(
    accountId: string,
    commentId: string,
    text: string,
    options?: MessageOptions
  ): Promise<ProviderSendResult>;

  /**
   * Delete a comment (Moderation)
   */
  deleteComment(
    accountId: string,
    commentId: string
  ): Promise<ProviderOperationResult>;

  /**
   * Hide or unhide a comment (Moderation)
   */
  hideComment(
    accountId: string,
    commentId: string,
    hide: boolean
  ): Promise<ProviderOperationResult>;

  /**
   * Check if a specific customer follows the connected account
   */
  checkFollowStatus(
    accountId: string,
    customerId: string
  ): Promise<boolean>;

  /**
   * Fetch public/follower profile info
   */
  getUserProfile(
    accountId: string,
    userId: string
  ): Promise<NormalizedUserProfile>;

  /**
   * Test live connectivity, token validity, and latency
   */
  testConnection(
    accountId: string
  ): Promise<ProviderHealthCheckResult>;
}
