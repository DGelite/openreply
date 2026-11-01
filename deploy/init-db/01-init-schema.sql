-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `username` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `emailVerified` DATETIME(3) NULL,
    `passwordHash` VARCHAR(191) NULL,
    `systemRole` ENUM('SUPER_ADMIN', 'ADMIN', 'MEMBER') NOT NULL DEFAULT 'MEMBER',
    `image` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_username_key`(`username`),
    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Account` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `providerAccountId` VARCHAR(191) NOT NULL,
    `refresh_token` TEXT NULL,
    `access_token` TEXT NULL,
    `expires_at` INTEGER NULL,
    `token_type` VARCHAR(191) NULL,
    `scope` VARCHAR(191) NULL,
    `id_token` TEXT NULL,
    `session_state` VARCHAR(191) NULL,

    INDEX `Account_userId_idx`(`userId`),
    UNIQUE INDEX `Account_provider_providerAccountId_key`(`provider`, `providerAccountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `sessionToken` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `expires` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Session_sessionToken_key`(`sessionToken`),
    INDEX `Session_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VerificationToken` (
    `identifier` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expires` DATETIME(3) NOT NULL,

    UNIQUE INDEX `VerificationToken_identifier_token_key`(`identifier`, `token`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Workspace` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `usagePeriodStart` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dmsSentThisPeriod` INTEGER NOT NULL DEFAULT 0,

    INDEX `Workspace_ownerId_idx`(`ownerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkspaceMember` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `role` ENUM('OWNER', 'ADMIN', 'MEMBER') NOT NULL DEFAULT 'OWNER',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WorkspaceMember_userId_idx`(`userId`),
    UNIQUE INDEX `WorkspaceMember_workspaceId_userId_key`(`workspaceId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkspaceInvitation` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `role` ENUM('OWNER', 'ADMIN', 'MEMBER') NOT NULL DEFAULT 'MEMBER',
    `token` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `invitedByUserId` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `acceptedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `WorkspaceInvitation_token_key`(`token`),
    INDEX `WorkspaceInvitation_email_idx`(`email`),
    INDEX `WorkspaceInvitation_workspaceId_idx`(`workspaceId`),
    INDEX `WorkspaceInvitation_status_idx`(`status`),
    UNIQUE INDEX `WorkspaceInvitation_workspaceId_email_key`(`workspaceId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InstagramAccount` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `instagramId` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `accessToken` TEXT NOT NULL,
    `tokenExpiresAt` DATETIME(3) NULL,
    `webhookSubscribed` BOOLEAN NOT NULL DEFAULT false,
    `connectedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `InstagramAccount_instagramId_key`(`instagramId`),
    INDEX `InstagramAccount_workspaceId_idx`(`workspaceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Automation` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `instagramAccountId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `goal` VARCHAR(191) NULL,
    `postId` VARCHAR(191) NULL,
    `postUrl` VARCHAR(191) NULL,
    `pendingNextReel` BOOLEAN NOT NULL DEFAULT false,
    `matchAnyPost` BOOLEAN NOT NULL DEFAULT false,
    `keywords` JSON NOT NULL,
    `matchAnyWord` BOOLEAN NOT NULL DEFAULT false,
    `dmMessage` TEXT NOT NULL,
    `openingDmEnabled` BOOLEAN NOT NULL DEFAULT false,
    `openingDmMessage` TEXT NULL,
    `openingDmButtonLabel` VARCHAR(191) NULL,
    `linkButtonLabel` VARCHAR(191) NULL,
    `publicReplyEnabled` BOOLEAN NOT NULL DEFAULT false,
    `publicReplyMessage` TEXT NULL,
    `publicReplyMessages` JSON NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `wholeWordMatch` BOOLEAN NOT NULL DEFAULT true,
    `reportShareSlug` VARCHAR(191) NULL,
    `reportShareEnabled` BOOLEAN NOT NULL DEFAULT true,
    `triggerType` ENUM('COMMENT', 'DIRECT_MESSAGE', 'STORY_REPLY', 'STORY_MENTION', 'STORY_REACTION', 'WELCOME', 'FAQ', 'GIVEAWAY', 'LEAD_MAGNET', 'COUPON') NOT NULL DEFAULT 'COMMENT',
    `collectEmail` BOOLEAN NOT NULL DEFAULT false,
    `collectPhone` BOOLEAN NOT NULL DEFAULT false,
    `collectPhoneSkipOtp` BOOLEAN NOT NULL DEFAULT false,
    `leadPromptEmail` TEXT NULL,
    `leadPromptPhone` TEXT NULL,
    `leadSuccessMessage` TEXT NULL,
    `leadMagnetFileUrl` TEXT NULL,
    `flowGraph` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Automation_reportShareSlug_key`(`reportShareSlug`),
    INDEX `Automation_workspaceId_idx`(`workspaceId`),
    INDEX `Automation_instagramAccountId_idx`(`instagramAccountId`),
    INDEX `Automation_postId_idx`(`postId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DmLog` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `automationId` VARCHAR(191) NOT NULL,
    `instagramAccountId` VARCHAR(191) NOT NULL,
    `commenterId` VARCHAR(191) NOT NULL,
    `commenterName` VARCHAR(191) NULL,
    `commentText` TEXT NOT NULL,
    `commentId` VARCHAR(191) NOT NULL,
    `type` ENUM('COMMENT_REPLY', 'DIRECT_MESSAGE') NOT NULL DEFAULT 'COMMENT_REPLY',
    `matchedKeyword` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'SENT', 'FAILED', 'SKIPPED_DEDUP', 'SKIPPED_RATE_LIMIT', 'SKIPPED_PLAN_LIMIT', 'SKIPPED_NO_MATCH') NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `dmSentAt` DATETIME(3) NULL,
    `errorMessage` TEXT NULL,
    `publicReplySentAt` DATETIME(3) NULL,
    `publicReplyError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DmLog_workspaceId_idx`(`workspaceId`),
    INDEX `DmLog_automationId_idx`(`automationId`),
    INDEX `DmLog_instagramAccountId_idx`(`instagramAccountId`),
    INDEX `DmLog_status_idx`(`status`),
    INDEX `DmLog_instagramAccountId_type_status_dmSentAt_idx`(`instagramAccountId`, `type`, `status`, `dmSentAt`),
    INDEX `DmLog_workspaceId_status_idx`(`workspaceId`, `status`),
    INDEX `DmLog_workspaceId_createdAt_idx`(`workspaceId`, `createdAt`),
    UNIQUE INDEX `DmLog_automationId_commentId_key`(`automationId`, `commentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProcessedComment` (
    `id` VARCHAR(191) NOT NULL,
    `instagramAccountId` VARCHAR(191) NOT NULL,
    `commentId` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `seenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ProcessedComment_commentId_key`(`commentId`),
    INDEX `ProcessedComment_instagramAccountId_idx`(`instagramAccountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProcessedMessage` (
    `id` VARCHAR(191) NOT NULL,
    `instagramAccountId` VARCHAR(191) NOT NULL,
    `mid` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `seenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ProcessedMessage_mid_key`(`mid`),
    INDEX `ProcessedMessage_instagramAccountId_idx`(`instagramAccountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TrackedLink` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `automationId` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NULL,
    `destinationUrl` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TrackedLink_slug_key`(`slug`),
    INDEX `TrackedLink_workspaceId_idx`(`workspaceId`),
    INDEX `TrackedLink_automationId_idx`(`automationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LinkClick` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `automationId` VARCHAR(191) NOT NULL,
    `instagramAccountId` VARCHAR(191) NOT NULL,
    `trackedLinkId` VARCHAR(191) NOT NULL,
    `ipHash` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `referrer` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LinkClick_workspaceId_idx`(`workspaceId`),
    INDEX `LinkClick_automationId_idx`(`automationId`),
    INDEX `LinkClick_instagramAccountId_idx`(`instagramAccountId`),
    INDEX `LinkClick_trackedLinkId_idx`(`trackedLinkId`),
    INDEX `LinkClick_createdAt_idx`(`createdAt`),
    INDEX `LinkClick_workspaceId_createdAt_idx`(`workspaceId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WebhookEvent` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NULL,
    `object` VARCHAR(191) NULL,
    `payload` JSON NOT NULL,
    `status` ENUM('PENDING', 'PROCESSED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `errorMessage` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processedAt` DATETIME(3) NULL,

    INDEX `WebhookEvent_workspaceId_idx`(`workspaceId`),
    INDEX `WebhookEvent_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OperationalEvent` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NULL,
    `source` ENUM('WORKER', 'TOKEN_REFRESH', 'HEALTH', 'SYSTEM') NOT NULL,
    `level` ENUM('INFO', 'WARNING', 'ERROR') NOT NULL DEFAULT 'INFO',
    `message` TEXT NOT NULL,
    `payload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolvedAt` DATETIME(3) NULL,

    INDEX `OperationalEvent_workspaceId_idx`(`workspaceId`),
    INDEX `OperationalEvent_source_idx`(`source`),
    INDEX `OperationalEvent_level_idx`(`level`),
    INDEX `OperationalEvent_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BackgroundJob` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `status` ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `error` TEXT NULL,
    `runAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lockedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BackgroundJob_status_runAt_idx`(`status`, `runAt`),
    INDEX `BackgroundJob_status_lockedAt_idx`(`status`, `lockedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConversationState` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `instagramAccountId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `step` ENUM('IDLE', 'AWAITING_EMAIL', 'AWAITING_PHONE', 'FLOW_NODE', 'COMPLETED') NOT NULL DEFAULT 'IDLE',
    `automationId` VARCHAR(191) NULL,
    `activeFlowId` VARCHAR(191) NULL,
    `activeNodeId` VARCHAR(191) NULL,
    `isHumanHandover` BOOLEAN NOT NULL DEFAULT false,
    `handoverAt` DATETIME(3) NULL,
    `lastInteractedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `metadata` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ConversationState_workspaceId_idx`(`workspaceId`),
    INDEX `ConversationState_userId_idx`(`userId`),
    INDEX `ConversationState_workspaceId_isHumanHandover_idx`(`workspaceId`, `isHumanHandover`),
    UNIQUE INDEX `ConversationState_instagramAccountId_userId_key`(`instagramAccountId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Lead` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `instagramAccountId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NULL,
    `name` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `sourceAutomationId` VARCHAR(191) NULL,
    `customData` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Lead_workspaceId_idx`(`workspaceId`),
    INDEX `Lead_instagramAccountId_idx`(`instagramAccountId`),
    INDEX `Lead_userId_idx`(`userId`),
    INDEX `Lead_email_idx`(`email`),
    INDEX `Lead_phone_idx`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tag` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NULL DEFAULT '#3b82f6',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Tag_workspaceId_idx`(`workspaceId`),
    UNIQUE INDEX `Tag_workspaceId_name_key`(`workspaceId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeadTag` (
    `id` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `tagId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LeadTag_leadId_idx`(`leadId`),
    INDEX `LeadTag_tagId_idx`(`tagId`),
    UNIQUE INDEX `LeadTag_leadId_tagId_key`(`leadId`, `tagId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DripCampaign` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `triggerType` VARCHAR(191) NOT NULL DEFAULT 'TAG_ADDED',
    `triggerKey` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DripCampaign_workspaceId_idx`(`workspaceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DripStep` (
    `id` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NOT NULL,
    `stepOrder` INTEGER NOT NULL DEFAULT 1,
    `delayMinutes` INTEGER NOT NULL DEFAULT 60,
    `messageType` VARCHAR(191) NOT NULL DEFAULT 'TEXT',
    `messageText` TEXT NULL,
    `mediaUrl` TEXT NULL,
    `flowId` VARCHAR(191) NULL,
    `buttons` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DripStep_campaignId_idx`(`campaignId`),
    INDEX `DripStep_campaignId_stepOrder_idx`(`campaignId`, `stepOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DripEnrollment` (
    `id` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `instagramAccountId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `currentStepIndex` INTEGER NOT NULL DEFAULT 0,
    `nextRunAt` DATETIME(3) NOT NULL,
    `status` ENUM('ACTIVE', 'COMPLETED', 'CANCELLED', 'PAUSED') NOT NULL DEFAULT 'ACTIVE',
    `lastError` TEXT NULL,
    `metadata` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DripEnrollment_workspaceId_idx`(`workspaceId`),
    INDEX `DripEnrollment_status_nextRunAt_idx`(`status`, `nextRunAt`),
    INDEX `DripEnrollment_userId_idx`(`userId`),
    INDEX `DripEnrollment_instagramAccountId_userId_status_idx`(`instagramAccountId`, `userId`, `status`),
    UNIQUE INDEX `DripEnrollment_campaignId_userId_key`(`campaignId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `price` DOUBLE NOT NULL DEFAULT 0,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'IRT',
    `imageUrl` TEXT NULL,
    `buyUrl` TEXT NULL,
    `category` VARCHAR(191) NULL,
    `sku` VARCHAR(191) NULL,
    `stock` INTEGER NOT NULL DEFAULT 999,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Product_workspaceId_idx`(`workspaceId`),
    INDEX `Product_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Giveaway` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `automationId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `maxTicketsPerUser` INTEGER NOT NULL DEFAULT 1,
    `totalEntries` INTEGER NOT NULL DEFAULT 0,
    `drawnAt` DATETIME(3) NULL,
    `status` ENUM('ACTIVE', 'DRAWN', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Giveaway_workspaceId_idx`(`workspaceId`),
    INDEX `Giveaway_automationId_idx`(`automationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GiveawayParticipant` (
    `id` VARCHAR(191) NOT NULL,
    `giveawayId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NULL,
    `ticketNumber` INTEGER NOT NULL,
    `entryTrigger` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `GiveawayParticipant_giveawayId_idx`(`giveawayId`),
    INDEX `GiveawayParticipant_userId_idx`(`userId`),
    UNIQUE INDEX `GiveawayParticipant_giveawayId_userId_key`(`giveawayId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GiveawayWinner` (
    `id` VARCHAR(191) NOT NULL,
    `giveawayId` VARCHAR(191) NOT NULL,
    `participantId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NULL,
    `ticketNumber` INTEGER NOT NULL,
    `winningRank` INTEGER NOT NULL DEFAULT 1,
    `drawnAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `GiveawayWinner_giveawayId_idx`(`giveawayId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CouponPool` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `automationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `defaultCode` VARCHAR(191) NULL,
    `isUniqueCodes` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CouponPool_workspaceId_idx`(`workspaceId`),
    INDEX `CouponPool_automationId_idx`(`automationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CouponCode` (
    `id` VARCHAR(191) NOT NULL,
    `poolId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `isClaimed` BOOLEAN NOT NULL DEFAULT false,
    `claimedByUserId` VARCHAR(191) NULL,
    `claimedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CouponCode_poolId_idx`(`poolId`),
    INDEX `CouponCode_claimedByUserId_idx`(`claimedByUserId`),
    UNIQUE INDEX `CouponCode_poolId_code_key`(`poolId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FaqItem` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `instagramAccountId` VARCHAR(191) NOT NULL,
    `question` VARCHAR(191) NOT NULL,
    `keywords` JSON NOT NULL,
    `answerText` TEXT NOT NULL,
    `linkUrl` VARCHAR(191) NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FaqItem_workspaceId_idx`(`workspaceId`),
    INDEX `FaqItem_instagramAccountId_idx`(`instagramAccountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiConfig` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `provider` ENUM('GEMINI', 'OPENAI', 'ANTHROPIC', 'DEEPSEEK', 'GROK', 'OPENROUTER', 'OLLAMA', 'AZURE_OPENAI', 'AWS_BEDROCK', 'CUSTOM') NOT NULL DEFAULT 'GEMINI',
    `model` VARCHAR(191) NOT NULL DEFAULT 'gemini-2.5-flash',
    `apiKeyEncrypted` TEXT NULL,
    `baseUrl` VARCHAR(191) NULL,
    `temperature` DOUBLE NOT NULL DEFAULT 0.7,
    `maxTokens` INTEGER NOT NULL DEFAULT 1000,
    `topP` DOUBLE NOT NULL DEFAULT 0.95,
    `topK` INTEGER NOT NULL DEFAULT 40,
    `brandVoice` TEXT NULL,
    `defaultTone` VARCHAR(191) NOT NULL DEFAULT 'friendly',
    `systemPrompt` TEXT NULL,
    `confidenceThreshold` DOUBLE NOT NULL DEFAULT 0.75,
    `manualApprovalMode` BOOLEAN NOT NULL DEFAULT false,
    `spamFilterEnabled` BOOLEAN NOT NULL DEFAULT true,
    `rateLimitPerMinute` INTEGER NOT NULL DEFAULT 60,
    `retryCount` INTEGER NOT NULL DEFAULT 3,
    `timeoutMs` INTEGER NOT NULL DEFAULT 15000,
    `safetySettings` JSON NOT NULL,
    `activeHoursEnabled` BOOLEAN NOT NULL DEFAULT false,
    `activeStartTime` VARCHAR(191) NULL DEFAULT '17:00',
    `activeEndTime` VARCHAR(191) NULL DEFAULT '08:00',
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'Asia/Tehran',
    `offlineMessage` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AiConfig_workspaceId_key`(`workspaceId`),
    INDEX `AiConfig_workspaceId_idx`(`workspaceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KnowledgeDocument` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `sourceType` VARCHAR(191) NOT NULL,
    `sourceUrl` VARCHAR(191) NULL,
    `content` TEXT NOT NULL,
    `metadata` JSON NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `isApproved` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `KnowledgeDocument_workspaceId_idx`(`workspaceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KnowledgeChunk` (
    `id` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `chunkIndex` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `embedding` JSON NOT NULL,
    `tokenCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `KnowledgeChunk_documentId_idx`(`documentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiConversationMemory` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `instagramAccountId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NOT NULL,
    `memoryKey` VARCHAR(191) NOT NULL,
    `memoryValue` TEXT NOT NULL,
    `confidence` DOUBLE NOT NULL DEFAULT 1.0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AiConversationMemory_workspaceId_idx`(`workspaceId`),
    INDEX `AiConversationMemory_userId_idx`(`userId`),
    UNIQUE INDEX `AiConversationMemory_workspaceId_userId_memoryKey_key`(`workspaceId`, `userId`, `memoryKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiGoal` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `goalType` ENUM('LEAD_GENERATION', 'PRODUCT_SALES', 'APPOINTMENT_BOOKING', 'UPSELLING', 'FAQ_COMPLETION', 'QUALIFICATION', 'SUPPORT_RESOLUTION') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `targetValue` VARCHAR(191) NULL,
    `progressScore` DOUBLE NOT NULL DEFAULT 0.0,
    `status` ENUM('IN_PROGRESS', 'ACHIEVED', 'FAILED', 'ABANDONED') NOT NULL DEFAULT 'IN_PROGRESS',
    `metadata` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AiGoal_workspaceId_idx`(`workspaceId`),
    INDEX `AiGoal_userId_idx`(`userId`),
    INDEX `AiGoal_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiAuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `feature` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `promptTokens` INTEGER NOT NULL DEFAULT 0,
    `completionTokens` INTEGER NOT NULL DEFAULT 0,
    `latencyMs` INTEGER NOT NULL DEFAULT 0,
    `confidenceScore` DOUBLE NULL,
    `intentDetected` VARCHAR(191) NULL,
    `securityCheckPassed` BOOLEAN NOT NULL DEFAULT true,
    `promptSanitized` BOOLEAN NOT NULL DEFAULT false,
    `errorMessage` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AiAuditLog_workspaceId_idx`(`workspaceId`),
    INDEX `AiAuditLog_feature_idx`(`feature`),
    INDEX `AiAuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SystemFeatureFlag` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NULL,
    `featureKey` VARCHAR(191) NOT NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `config` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SystemFeatureFlag_featureKey_idx`(`featureKey`),
    UNIQUE INDEX `SystemFeatureFlag_workspaceId_featureKey_key`(`workspaceId`, `featureKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeadLetterMessage` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NULL,
    `source` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `errorMessage` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'FAILED',
    `attempts` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DeadLetterMessage_workspaceId_idx`(`workspaceId`),
    INDEX `DeadLetterMessage_status_idx`(`status`),
    INDEX `DeadLetterMessage_createdAt_idx`(`createdAt`),
    INDEX `DeadLetterMessage_workspaceId_status_idx`(`workspaceId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FunnelEvent` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `automationId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NOT NULL,
    `stage` VARCHAR(191) NOT NULL,
    `metadata` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FunnelEvent_workspaceId_idx`(`workspaceId`),
    INDEX `FunnelEvent_automationId_idx`(`automationId`),
    INDEX `FunnelEvent_userId_idx`(`userId`),
    INDEX `FunnelEvent_stage_idx`(`stage`),
    INDEX `FunnelEvent_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeadForm` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `fields` JSON NOT NULL,
    `settings` JSON NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `viewCount` INTEGER NOT NULL DEFAULT 0,
    `submitCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LeadForm_slug_key`(`slug`),
    INDEX `LeadForm_workspaceId_idx`(`workspaceId`),
    INDEX `LeadForm_slug_idx`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeadFormSubmission` (
    `id` VARCHAR(191) NOT NULL,
    `formId` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `data` JSON NOT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` TEXT NULL,
    `referrer` VARCHAR(191) NULL,
    `syncedToCrm` BOOLEAN NOT NULL DEFAULT false,
    `crmLeadId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LeadFormSubmission_formId_idx`(`formId`),
    INDEX `LeadFormSubmission_workspaceId_idx`(`workspaceId`),
    INDEX `LeadFormSubmission_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Account` ADD CONSTRAINT `Account_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Workspace` ADD CONSTRAINT `Workspace_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkspaceMember` ADD CONSTRAINT `WorkspaceMember_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkspaceMember` ADD CONSTRAINT `WorkspaceMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkspaceInvitation` ADD CONSTRAINT `WorkspaceInvitation_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkspaceInvitation` ADD CONSTRAINT `WorkspaceInvitation_invitedByUserId_fkey` FOREIGN KEY (`invitedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InstagramAccount` ADD CONSTRAINT `InstagramAccount_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Automation` ADD CONSTRAINT `Automation_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Automation` ADD CONSTRAINT `Automation_instagramAccountId_fkey` FOREIGN KEY (`instagramAccountId`) REFERENCES `InstagramAccount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DmLog` ADD CONSTRAINT `DmLog_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DmLog` ADD CONSTRAINT `DmLog_automationId_fkey` FOREIGN KEY (`automationId`) REFERENCES `Automation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DmLog` ADD CONSTRAINT `DmLog_instagramAccountId_fkey` FOREIGN KEY (`instagramAccountId`) REFERENCES `InstagramAccount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TrackedLink` ADD CONSTRAINT `TrackedLink_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TrackedLink` ADD CONSTRAINT `TrackedLink_automationId_fkey` FOREIGN KEY (`automationId`) REFERENCES `Automation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LinkClick` ADD CONSTRAINT `LinkClick_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LinkClick` ADD CONSTRAINT `LinkClick_automationId_fkey` FOREIGN KEY (`automationId`) REFERENCES `Automation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LinkClick` ADD CONSTRAINT `LinkClick_instagramAccountId_fkey` FOREIGN KEY (`instagramAccountId`) REFERENCES `InstagramAccount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LinkClick` ADD CONSTRAINT `LinkClick_trackedLinkId_fkey` FOREIGN KEY (`trackedLinkId`) REFERENCES `TrackedLink`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WebhookEvent` ADD CONSTRAINT `WebhookEvent_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OperationalEvent` ADD CONSTRAINT `OperationalEvent_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationState` ADD CONSTRAINT `ConversationState_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationState` ADD CONSTRAINT `ConversationState_automationId_fkey` FOREIGN KEY (`automationId`) REFERENCES `Automation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_sourceAutomationId_fkey` FOREIGN KEY (`sourceAutomationId`) REFERENCES `Automation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Tag` ADD CONSTRAINT `Tag_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadTag` ADD CONSTRAINT `LeadTag_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadTag` ADD CONSTRAINT `LeadTag_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `Tag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DripCampaign` ADD CONSTRAINT `DripCampaign_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DripStep` ADD CONSTRAINT `DripStep_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `DripCampaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DripEnrollment` ADD CONSTRAINT `DripEnrollment_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `DripCampaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Giveaway` ADD CONSTRAINT `Giveaway_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Giveaway` ADD CONSTRAINT `Giveaway_automationId_fkey` FOREIGN KEY (`automationId`) REFERENCES `Automation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GiveawayParticipant` ADD CONSTRAINT `GiveawayParticipant_giveawayId_fkey` FOREIGN KEY (`giveawayId`) REFERENCES `Giveaway`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GiveawayWinner` ADD CONSTRAINT `GiveawayWinner_giveawayId_fkey` FOREIGN KEY (`giveawayId`) REFERENCES `Giveaway`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GiveawayWinner` ADD CONSTRAINT `GiveawayWinner_participantId_fkey` FOREIGN KEY (`participantId`) REFERENCES `GiveawayParticipant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CouponPool` ADD CONSTRAINT `CouponPool_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CouponPool` ADD CONSTRAINT `CouponPool_automationId_fkey` FOREIGN KEY (`automationId`) REFERENCES `Automation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CouponCode` ADD CONSTRAINT `CouponCode_poolId_fkey` FOREIGN KEY (`poolId`) REFERENCES `CouponPool`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FaqItem` ADD CONSTRAINT `FaqItem_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiConfig` ADD CONSTRAINT `AiConfig_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KnowledgeDocument` ADD CONSTRAINT `KnowledgeDocument_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KnowledgeChunk` ADD CONSTRAINT `KnowledgeChunk_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `KnowledgeDocument`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiConversationMemory` ADD CONSTRAINT `AiConversationMemory_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiGoal` ADD CONSTRAINT `AiGoal_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiAuditLog` ADD CONSTRAINT `AiAuditLog_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadForm` ADD CONSTRAINT `LeadForm_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadFormSubmission` ADD CONSTRAINT `LeadFormSubmission_formId_fkey` FOREIGN KEY (`formId`) REFERENCES `LeadForm`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadFormSubmission` ADD CONSTRAINT `LeadFormSubmission_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
