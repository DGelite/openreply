-- OpenReply Multi-Provider & BoxAPI Architecture Migration
-- Safe DDL migration script for MariaDB / MySQL

-- 1. Update InstagramAccount with Multi-Provider columns
ALTER TABLE `InstagramAccount`
  ADD COLUMN `primaryProvider` ENUM('META', 'BOXAPI') NOT NULL DEFAULT 'META',
  ADD COLUMN `backupProvider` ENUM('META', 'BOXAPI') NULL,
  ADD COLUMN `orchestrationMode` ENUM('BOXAPI_PRIMARY', 'META_PRIMARY', 'SMART_HYBRID') NOT NULL DEFAULT 'META_PRIMARY',
  ADD COLUMN `boxApiToken` TEXT NULL,
  ADD COLUMN `boxAccountId` VARCHAR(191) NULL,
  ADD COLUMN `boxApiKey` TEXT NULL,
  ADD COLUMN `boxWebhookSecret` TEXT NULL,
  ADD COLUMN `boxConnectedAt` DATETIME(3) NULL,
  ADD COLUMN `metaConnectedAt` DATETIME(3) NULL,
  ADD COLUMN `lastFailoverAt` DATETIME(3) NULL,
  ADD COLUMN `failoverCount` INT NOT NULL DEFAULT 0;

CREATE INDEX `InstagramAccount_primaryProvider_idx` ON `InstagramAccount`(`primaryProvider`);
CREATE INDEX `InstagramAccount_orchestrationMode_idx` ON `InstagramAccount`(`orchestrationMode`);

-- 2. Update Lead with Multi-Provider and Verification columns
ALTER TABLE `Lead`
  ADD COLUMN `provider` ENUM('META', 'BOXAPI') NOT NULL DEFAULT 'META',
  ADD COLUMN `externalUserId` VARCHAR(191) NULL,
  ADD COLUMN `phoneVerified` BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN `otpCode` VARCHAR(191) NULL,
  ADD COLUMN `otpExpiresAt` DATETIME(3) NULL,
  ADD COLUMN `otpAttempts` INT NOT NULL DEFAULT 0,
  ADD COLUMN `otpChannel` VARCHAR(191) NULL,
  ADD COLUMN `crmSyncStatus` ENUM('PENDING', 'SYNCED', 'FAILED', 'RETRYING') NOT NULL DEFAULT 'PENDING',
  ADD COLUMN `crmLeadId` VARCHAR(191) NULL,
  ADD COLUMN `crmSyncedAt` DATETIME(3) NULL,
  ADD COLUMN `crmError` TEXT NULL;

CREATE INDEX `Lead_provider_idx` ON `Lead`(`provider`);
CREATE INDEX `Lead_crmSyncStatus_idx` ON `Lead`(`crmSyncStatus`);

-- 3. InboundEventLedger
CREATE TABLE IF NOT EXISTS `InboundEventLedger` (
  `id` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `provider` ENUM('META', 'BOXAPI') NOT NULL,
  `accountId` VARCHAR(191) NOT NULL,
  `eventType` VARCHAR(191) NOT NULL,
  `rawPayload` JSON NOT NULL,
  `source` VARCHAR(191) NOT NULL,
  `processed` BOOLEAN NOT NULL DEFAULT FALSE,
  `processedAt` DATETIME(3) NULL,
  `error` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `InboundEventLedger_idempotencyKey_key` (`idempotencyKey`),
  INDEX `InboundEventLedger_provider_accountId_idx` (`provider`, `accountId`),
  INDEX `InboundEventLedger_processed_createdAt_idx` (`processed`, `createdAt`),
  INDEX `InboundEventLedger_eventType_idx` (`eventType`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 4. ProviderHealthLog
CREATE TABLE IF NOT EXISTS `ProviderHealthLog` (
  `id` VARCHAR(191) NOT NULL,
  `instagramAccountId` VARCHAR(191) NOT NULL,
  `provider` ENUM('META', 'BOXAPI') NOT NULL,
  `status` VARCHAR(191) NOT NULL,
  `latencyMs` INT NULL,
  `statusCode` INT NULL,
  `errorMessage` TEXT NULL,
  `checkType` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `ProviderHealthLog_instagramAccountId_provider_createdAt_idx` (`instagramAccountId`, `provider`, `createdAt`),
  CONSTRAINT `ProviderHealthLog_instagramAccountId_fkey` FOREIGN KEY (`instagramAccountId`) REFERENCES `InstagramAccount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 5. ProviderFailoverLog
CREATE TABLE IF NOT EXISTS `ProviderFailoverLog` (
  `id` VARCHAR(191) NOT NULL,
  `instagramAccountId` VARCHAR(191) NOT NULL,
  `fromProvider` ENUM('META', 'BOXAPI') NOT NULL,
  `toProvider` ENUM('META', 'BOXAPI') NOT NULL,
  `reason` TEXT NOT NULL,
  `errorCategory` VARCHAR(191) NOT NULL,
  `automatic` BOOLEAN NOT NULL DEFAULT TRUE,
  `recoveredAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `ProviderFailoverLog_instagramAccountId_createdAt_idx` (`instagramAccountId`, `createdAt`),
  CONSTRAINT `ProviderFailoverLog_instagramAccountId_fkey` FOREIGN KEY (`instagramAccountId`) REFERENCES `InstagramAccount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 6. ReconciliationCheckpoint
CREATE TABLE IF NOT EXISTS `ReconciliationCheckpoint` (
  `id` VARCHAR(191) NOT NULL,
  `instagramAccountId` VARCHAR(191) NOT NULL,
  `postId` VARCHAR(191) NOT NULL,
  `lastCommentTakenAt` DATETIME(3) NULL,
  `lastCommentId` VARCHAR(191) NULL,
  `lastScannedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `scannedCount` INT NOT NULL DEFAULT 0,
  `recoveredCount` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ReconciliationCheckpoint_instagramAccountId_postId_key` (`instagramAccountId`, `postId`),
  INDEX `ReconciliationCheckpoint_lastScannedAt_idx` (`lastScannedAt`),
  CONSTRAINT `ReconciliationCheckpoint_instagramAccountId_fkey` FOREIGN KEY (`instagramAccountId`) REFERENCES `InstagramAccount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
