-- ==============================================================================
-- OpenReply Database Migration 03: Advanced AI Persona, Operating Schedule & Phone Extraction
-- Target Database: MariaDB 10.11+ / MySQL 8.0+
-- ==============================================================================

-- 1. Extend ConversationState with Phone Extraction & Conversation Lifecycle
ALTER TABLE `ConversationState`
  ADD COLUMN IF NOT EXISTS `conversationStatus` VARCHAR(50) NOT NULL DEFAULT 'NEW',
  ADD COLUMN IF NOT EXISTS `extractedPhone` VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS `phoneConfidence` FLOAT NULL,
  ADD COLUMN IF NOT EXISTS `phoneOwner` VARCHAR(30) NULL,
  ADD COLUMN IF NOT EXISTS `phoneRaw` VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS `phoneBuffer` VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS `phoneBufferExpiresAt` DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS `internalNotes` TEXT NULL;

-- 2. Extend Lead with phone confidence and owner metadata
ALTER TABLE `Lead`
  ADD COLUMN IF NOT EXISTS `phoneConfidence` FLOAT NULL,
  ADD COLUMN IF NOT EXISTS `phoneOwner` VARCHAR(30) NULL,
  ADD COLUMN IF NOT EXISTS `phoneRaw` VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS `phoneNotes` TEXT NULL;

-- 3. Extend AiConfig with Business Persona & Funnel parameters
ALTER TABLE `AiConfig`
  ADD COLUMN IF NOT EXISTS `assistantName` VARCHAR(100) NULL DEFAULT 'دستیار هوشمند',
  ADD COLUMN IF NOT EXISTS `roleTitle` VARCHAR(100) NULL DEFAULT 'مشاور فروش و پشتیبانی',
  ADD COLUMN IF NOT EXISTS `businessType` VARCHAR(100) NULL DEFAULT 'کسب‌وکار و خدمات',
  ADD COLUMN IF NOT EXISTS `targetAudience` VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS `personalityDemeanor` VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS `preferredWords` JSON NULL,
  ADD COLUMN IF NOT EXISTS `forbiddenWords` JSON NULL,
  ADD COLUMN IF NOT EXISTS `unhappyClientPolicy` TEXT NULL,
  ADD COLUMN IF NOT EXISTS `priceObjectionPolicy` TEXT NULL,
  ADD COLUMN IF NOT EXISTS `hesitantClientPolicy` TEXT NULL,
  ADD COLUMN IF NOT EXISTS `humanEscalationTriggers` JSON NULL,
  ADD COLUMN IF NOT EXISTS `primaryGoal` VARCHAR(50) NOT NULL DEFAULT 'LEAD_GENERATION',
  ADD COLUMN IF NOT EXISTS `outOfHoursAction` VARCHAR(50) NOT NULL DEFAULT 'OUT_OF_OFFICE_MESSAGE';

-- 4. Create OperatingSchedule table
CREATE TABLE IF NOT EXISTS `OperatingSchedule` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `instagramAccountId` VARCHAR(191) NOT NULL,
  `isEnabled` BOOLEAN NOT NULL DEFAULT TRUE,
  `timezone` VARCHAR(100) NOT NULL DEFAULT 'Asia/Tehran',
  `scheduleJson` JSON NOT NULL,
  `holidaysJson` JSON NOT NULL,
  `outOfHoursAction` VARCHAR(50) NOT NULL DEFAULT 'OUT_OF_OFFICE_MESSAGE',
  `outOfHoursMessage` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `OperatingSchedule_instagramAccountId_key` (`instagramAccountId`),
  KEY `OperatingSchedule_workspaceId_idx` (`workspaceId`),
  KEY `OperatingSchedule_instagramAccountId_idx` (`instagramAccountId`),
  CONSTRAINT `OperatingSchedule_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace` (`id`) ON DELETE CASCADE,
  CONSTRAINT `OperatingSchedule_instagramAccountId_fkey` FOREIGN KEY (`instagramAccountId`) REFERENCES `InstagramAccount` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
