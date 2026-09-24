-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Jul 31, 2026 at 10:22 PM
-- Server version: 10.11.18-MariaDB
-- PHP Version: 8.4.23

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `digitale_digitaleliteisntal`
--

-- --------------------------------------------------------

--
-- Table structure for table `Account`
--

CREATE TABLE `Account` (
  `id` varchar(191) NOT NULL,
  `userId` varchar(191) NOT NULL,
  `type` varchar(191) NOT NULL,
  `provider` varchar(191) NOT NULL,
  `providerAccountId` varchar(191) NOT NULL,
  `refresh_token` text DEFAULT NULL,
  `access_token` text DEFAULT NULL,
  `expires_at` int(11) DEFAULT NULL,
  `token_type` varchar(191) DEFAULT NULL,
  `scope` varchar(191) DEFAULT NULL,
  `id_token` text DEFAULT NULL,
  `session_state` varchar(191) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `AiAuditLog`
--

CREATE TABLE `AiAuditLog` (
  `id` varchar(191) NOT NULL,
  `workspaceId` varchar(191) NOT NULL,
  `feature` varchar(191) NOT NULL,
  `provider` varchar(191) NOT NULL,
  `model` varchar(191) NOT NULL,
  `promptTokens` int(11) NOT NULL DEFAULT 0,
  `completionTokens` int(11) NOT NULL DEFAULT 0,
  `latencyMs` int(11) NOT NULL DEFAULT 0,
  `confidenceScore` double DEFAULT NULL,
  `intentDetected` varchar(191) DEFAULT NULL,
  `securityCheckPassed` tinyint(1) NOT NULL DEFAULT 1,
  `promptSanitized` tinyint(1) NOT NULL DEFAULT 0,
  `errorMessage` text DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `AiConfig`
--

CREATE TABLE `AiConfig` (
  `id` varchar(191) NOT NULL,
  `workspaceId` varchar(191) NOT NULL,
  `isEnabled` tinyint(1) NOT NULL DEFAULT 1,
  `provider` enum('GEMINI','OPENAI','ANTHROPIC','DEEPSEEK','GROK','OPENROUTER','OLLAMA','AZURE_OPENAI','AWS_BEDROCK','CUSTOM') NOT NULL DEFAULT 'GEMINI',
  `model` varchar(191) NOT NULL DEFAULT 'gemini-2.5-flash',
  `apiKeyEncrypted` text DEFAULT NULL,
  `baseUrl` varchar(191) DEFAULT NULL,
  `temperature` double NOT NULL DEFAULT 0.7,
  `maxTokens` int(11) NOT NULL DEFAULT 1000,
  `topP` double NOT NULL DEFAULT 0.95,
  `topK` int(11) NOT NULL DEFAULT 40,
  `brandVoice` text DEFAULT NULL,
  `defaultTone` varchar(191) NOT NULL DEFAULT 'friendly',
  `systemPrompt` text DEFAULT NULL,
  `confidenceThreshold` double NOT NULL DEFAULT 0.75,
  `manualApprovalMode` tinyint(1) NOT NULL DEFAULT 0,
  `spamFilterEnabled` tinyint(1) NOT NULL DEFAULT 1,
  `rateLimitPerMinute` int(11) NOT NULL DEFAULT 60,
  `retryCount` int(11) NOT NULL DEFAULT 3,
  `timeoutMs` int(11) NOT NULL DEFAULT 15000,
  `safetySettings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`safetySettings`)),
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  `activeEndTime` varchar(191) DEFAULT '08:00',
  `activeHoursEnabled` tinyint(1) NOT NULL DEFAULT 0,
  `activeStartTime` varchar(191) DEFAULT '17:00',
  `offlineMessage` text DEFAULT NULL,
  `timezone` varchar(191) NOT NULL DEFAULT 'Asia/Tehran'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `AiConversationMemory`
--

CREATE TABLE `AiConversationMemory` (
  `id` varchar(191) NOT NULL,
  `workspaceId` varchar(191) NOT NULL,
  `instagramAccountId` varchar(191) DEFAULT NULL,
  `userId` varchar(191) NOT NULL,
  `memoryKey` varchar(191) NOT NULL,
  `memoryValue` text NOT NULL,
  `confidence` double NOT NULL DEFAULT 1,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `AiGoal`
--

CREATE TABLE `AiGoal` (
  `id` varchar(191) NOT NULL,
  `workspaceId` varchar(191) NOT NULL,
  `userId` varchar(191) NOT NULL,
  `goalType` enum('LEAD_GENERATION','PRODUCT_SALES','APPOINTMENT_BOOKING','UPSELLING','FAQ_COMPLETION','QUALIFICATION','SUPPORT_RESOLUTION') NOT NULL,
  `title` varchar(191) NOT NULL,
  `targetValue` varchar(191) DEFAULT NULL,
  `progressScore` double NOT NULL DEFAULT 0,
  `status` enum('IN_PROGRESS','ACHIEVED','FAILED','ABANDONED') NOT NULL DEFAULT 'IN_PROGRESS',
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`metadata`)),
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `Automation`
--

CREATE TABLE `Automation` (
  `id` varchar(191) NOT NULL,
  `workspaceId` varchar(191) NOT NULL,
  `instagramAccountId` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `goal` varchar(191) DEFAULT NULL,
  `postId` varchar(191) DEFAULT NULL,
  `postUrl` varchar(191) DEFAULT NULL,
  `pendingNextReel` tinyint(1) NOT NULL DEFAULT 0,
  `matchAnyPost` tinyint(1) NOT NULL DEFAULT 0,
  `keywords` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`keywords`)),
  `matchAnyWord` tinyint(1) NOT NULL DEFAULT 0,
  `dmMessage` text NOT NULL,
  `openingDmEnabled` tinyint(1) NOT NULL DEFAULT 0,
  `openingDmMessage` text DEFAULT NULL,
  `openingDmButtonLabel` varchar(191) DEFAULT NULL,
  `linkButtonLabel` varchar(191) DEFAULT NULL,
  `publicReplyEnabled` tinyint(1) NOT NULL DEFAULT 0,
  `publicReplyMessage` text DEFAULT NULL,
  `publicReplyMessages` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`publicReplyMessages`)),
  `isActive` tinyint(1) NOT NULL DEFAULT 1,
  `wholeWordMatch` tinyint(1) NOT NULL DEFAULT 1,
  `reportShareSlug` varchar(191) DEFAULT NULL,
  `reportShareEnabled` tinyint(1) NOT NULL DEFAULT 1,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  `collectEmail` tinyint(1) NOT NULL DEFAULT 0,
  `collectPhone` tinyint(1) NOT NULL DEFAULT 0,
  `leadMagnetFileUrl` text DEFAULT NULL,
  `leadPromptEmail` text DEFAULT NULL,
  `leadPromptPhone` text DEFAULT NULL,
  `leadSuccessMessage` text DEFAULT NULL,
  `triggerType` enum('COMMENT','DIRECT_MESSAGE','STORY_REPLY','STORY_MENTION','FAQ','GIVEAWAY','LEAD_MAGNET','COUPON') NOT NULL DEFAULT 'COMMENT',
  `collectPhoneSkipOtp` tinyint(1) NOT NULL DEFAULT 0,
  `flowGraph` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`flowGraph`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `BackgroundJob`
--

CREATE TABLE `BackgroundJob` (
  `id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`payload`)),
  `status` enum('PENDING','RUNNING','COMPLETED','FAILED') NOT NULL DEFAULT 'PENDING',
  `attempts` int(11) NOT NULL DEFAULT 0,
  `error` text DEFAULT NULL,
  `runAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `lockedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `BackgroundJob`
--

INSERT INTO `BackgroundJob` (`id`, `name`, `payload`, `status`, `attempts`, `error`, `runAt`, `lockedAt`, `createdAt`, `updatedAt`) VALUES
('cms1vs6he0001swnp3s6vtykm', 'process-comment', '{\"instagramAccountId\":\"0\",\"commentId\":\"17865799348089039\",\"commentText\":\"This is an example.\",\"commenterId\":\"232323232\",\"commenterName\":\"test\",\"mediaId\":\"123123123\",\"source\":\"WEBHOOK\"}', 'COMPLETED', 0, NULL, '2026-07-26 14:16:04.561', NULL, '2026-07-26 14:16:04.562', '2026-07-26 14:16:05.190'),
('cms1wsr430007swo8g1tn8uca', 'process-comment', '{\"instagramAccountId\":\"17841401025517140\",\"commentId\":\"18111561478962603\",\"commentText\":\"سلام\",\"commenterId\":\"26216811814633132\",\"commenterName\":\"armin.reel\",\"mediaId\":\"17924684643158874\",\"source\":\"WEBHOOK\"}', 'COMPLETED', 0, NULL, '2026-07-26 14:44:30.914', NULL, '2026-07-26 14:44:30.916', '2026-07-26 14:44:31.001'),
('cms1wvcr90009swo83ex3rb5q', 'process-comment', '{\"instagramAccountId\":\"17841401025517140\",\"commentId\":\"18146458084544289\",\"commentText\":\"سلام\",\"commenterId\":\"26216811814633132\",\"commenterName\":\"armin.reel\",\"mediaId\":\"17924684643158874\",\"source\":\"WEBHOOK\"}', 'COMPLETED', 0, NULL, '2026-07-26 14:46:32.276', NULL, '2026-07-26 14:46:32.278', '2026-07-26 14:46:32.989'),
('cms1ww1q1000bswo89ozz5tk2', 'process-comment', '{\"instagramAccountId\":\"17841401025517140\",\"commentId\":\"17894721114379146\",\"commentText\":\"سلام\",\"commenterId\":\"26216811814633132\",\"commenterName\":\"armin.reel\",\"mediaId\":\"17924684643158874\",\"source\":\"WEBHOOK\"}', 'COMPLETED', 0, NULL, '2026-07-26 14:47:04.632', NULL, '2026-07-26 14:47:04.633', '2026-07-26 14:47:06.676'),
('cms1wy15p0000swguh52pcwlm', 'process-comment', '{\"instagramAccountId\":\"17841401025517140\",\"commentId\":\"18111561478962603\",\"commentText\":\"سلام\",\"commenterId\":\"26216811814633132\",\"commenterName\":\"armin.reel\",\"mediaId\":\"17924684643158874\",\"source\":\"POLLING\"}', 'COMPLETED', 0, NULL, '2026-07-26 14:48:37.193', NULL, '2026-07-26 14:48:37.214', '2026-07-26 14:48:38.576'),
('cms1wy16g0001swgul40gwdlm', 'process-comment', '{\"instagramAccountId\":\"17841401025517140\",\"commentId\":\"18146458084544289\",\"commentText\":\"سلام\",\"commenterId\":\"26216811814633132\",\"commenterName\":\"armin.reel\",\"mediaId\":\"17924684643158874\",\"source\":\"POLLING\"}', 'COMPLETED', 0, NULL, '2026-07-26 14:48:37.234', NULL, '2026-07-26 14:48:37.240', '2026-07-26 14:48:38.591'),
('cms1x08nt000pswo88bv71dts', 'process-comment', '{\"instagramAccountId\":\"17841401025517140\",\"commentId\":\"17978089953117706\",\"commentText\":\"op\",\"commenterId\":\"26216811814633132\",\"commenterName\":\"armin.reel\",\"mediaId\":\"17924684643158874\",\"source\":\"WEBHOOK\"}', 'COMPLETED', 0, NULL, '2026-07-26 14:50:20.248', NULL, '2026-07-26 14:50:20.249', '2026-07-26 14:50:21.584'),
('cms1x3pu0000yswo8526nskqy', 'process-comment', '{\"instagramAccountId\":\"17841401025517140\",\"commentId\":\"17974324341072719\",\"commentText\":\"عالی\",\"commenterId\":\"26216811814633132\",\"commenterName\":\"armin.reel\",\"mediaId\":\"17924684643158874\",\"source\":\"WEBHOOK\"}', 'COMPLETED', 0, NULL, '2026-07-26 14:53:02.471', NULL, '2026-07-26 14:53:02.472', '2026-07-26 14:53:02.678'),
('cms1x4pn30010swo8tp4un3yq', 'process-comment', '{\"instagramAccountId\":\"17841401025517140\",\"commentId\":\"17891575071397732\",\"commentText\":\"عالی\",\"commenterId\":\"26216811814633132\",\"commenterName\":\"armin.reel\",\"mediaId\":\"17924684643158874\",\"source\":\"WEBHOOK\"}', 'COMPLETED', 0, NULL, '2026-07-26 14:53:48.878', NULL, '2026-07-26 14:53:48.879', '2026-07-26 14:53:49.671'),
('cms1x4xds0012swo813ztvhoq', 'process-comment', '{\"instagramAccountId\":\"17841401025517140\",\"commentId\":\"17937878601293199\",\"commentText\":\"ts\",\"commenterId\":\"26216811814633132\",\"commenterName\":\"armin.reel\",\"mediaId\":\"17924684643158874\",\"source\":\"WEBHOOK\"}', 'COMPLETED', 0, NULL, '2026-07-26 14:53:58.911', NULL, '2026-07-26 14:53:58.912', '2026-07-26 14:53:59.845'),
('cms1xbpek0002swo00xudwn79', 'process-comment', '{\"instagramAccountId\":\"17841401025517140\",\"commentId\":\"17965901166128631\",\"commentText\":\"عالی\",\"commenterId\":\"26216811814633132\",\"commenterName\":\"armin.reel\",\"mediaId\":\"17924684643158874\",\"source\":\"WEBHOOK\"}', 'COMPLETED', 0, NULL, '2026-07-26 14:59:15.163', NULL, '2026-07-26 14:59:15.164', '2026-07-26 14:59:15.488'),
('cms1xc4ex0004swo0a91yhvru', 'process-comment', '{\"instagramAccountId\":\"17841401025517140\",\"commentId\":\"18091426895633000\",\"commentText\":\"op\",\"commenterId\":\"26216811814633132\",\"commenterName\":\"armin.reel\",\"mediaId\":\"17924684643158874\",\"source\":\"WEBHOOK\"}', 'COMPLETED', 0, NULL, '2026-07-26 14:59:34.615', NULL, '2026-07-26 14:59:34.617', '2026-07-26 14:59:36.521'),
('cms1y9kpe0006swo0onmt0wri', 'process-comment', '{\"instagramAccountId\":\"17841401025517140\",\"commentId\":\"18076897052700994\",\"commentText\":\"gombol\",\"commenterId\":\"7362932433784009\",\"commenterName\":\"ghazal._.8022\",\"mediaId\":\"17924684643158874\",\"source\":\"WEBHOOK\"}', 'COMPLETED', 0, NULL, '2026-07-26 15:25:35.377', NULL, '2026-07-26 15:25:35.378', '2026-07-26 15:25:41.544'),
('cms1ya10h000bswo0ezop867c', 'process-comment', '{\"instagramAccountId\":\"17841401025517140\",\"commentId\":\"18090723791635196\",\"commentText\":\"gombol\",\"commenterId\":\"7362932433784009\",\"commenterName\":\"ghazal._.8022\",\"mediaId\":\"17924684643158874\",\"source\":\"WEBHOOK\"}', 'COMPLETED', 0, NULL, '2026-07-26 15:25:56.512', NULL, '2026-07-26 15:25:56.513', '2026-07-26 15:25:58.015'),
('cms1znyo00002swrmcpz1ihar', 'process-comment', '{\"instagramAccountId\":\"17841401025517140\",\"commentId\":\"18063851687719643\",\"commentText\":\"gombol\",\"commenterId\":\"7362932433784009\",\"commenterName\":\"ghazal._.8022\",\"mediaId\":\"17924684643158874\",\"source\":\"WEBHOOK\"}', 'COMPLETED', 0, NULL, '2026-07-26 16:04:46.269', NULL, '2026-07-26 16:04:46.272', '2026-07-26 16:04:47.888'),
('cms1zoovp0008swrmw4z5gmew', 'process-comment', '{\"instagramAccountId\":\"17841401025517140\",\"commentId\":\"18050477894606114\",\"commentText\":\"gombol\",\"commenterId\":\"7362932433784009\",\"commenterName\":\"ghazal._.8022\",\"mediaId\":\"17924684643158874\",\"source\":\"WEBHOOK\"}', 'COMPLETED', 0, NULL, '2026-07-26 16:05:20.245', NULL, '2026-07-26 16:05:20.246', '2026-07-26 16:05:22.268'),
('cms33vr3f0005swf6no1xztl4', 'process-comment', '{\"instagramAccountId\":\"17841401025517140\",\"commentId\":\"17975862404900413\",\"commentText\":\"سلام\",\"commenterId\":\"26216811814633132\",\"commenterName\":\"armin.reel\",\"mediaId\":\"17924684643158874\",\"source\":\"WEBHOOK\"}', 'COMPLETED', 0, NULL, '2026-07-27 10:50:34.336', NULL, '2026-07-27 10:50:34.347', '2026-07-27 10:50:35.285'),
('cms33yc8d0007swf6vfxmpquj', 'process-comment', '{\"instagramAccountId\":\"17841401025517140\",\"commentId\":\"17954580360193126\",\"commentText\":\"op\",\"commenterId\":\"26216811814633132\",\"commenterName\":\"armin.reel\",\"mediaId\":\"17924684643158874\",\"source\":\"WEBHOOK\"}', 'COMPLETED', 0, NULL, '2026-07-27 10:52:35.049', NULL, '2026-07-27 10:52:35.053', '2026-07-27 10:52:37.165'),
('cms33ype10008swf6awzp9gvv', 'process-comment', '{\"instagramAccountId\":\"37166246299687429\",\"commentId\":\"17975862404900413\",\"commentText\":\"سلام\",\"commenterId\":\"26216811814633132\",\"commenterName\":\"armin.reel\",\"mediaId\":\"17924684643158874\",\"source\":\"POLLING\"}', 'COMPLETED', 0, NULL, '2026-07-27 10:52:52.104', NULL, '2026-07-27 10:52:52.105', '2026-07-27 10:52:52.505'),
('cms33ype40009swf6o63ya9nd', 'process-comment', '{\"instagramAccountId\":\"37166246299687429\",\"commentId\":\"17954580360193126\",\"commentText\":\"op\",\"commenterId\":\"26216811814633132\",\"commenterName\":\"armin.reel\",\"mediaId\":\"17924684643158874\",\"source\":\"POLLING\"}', 'COMPLETED', 0, NULL, '2026-07-27 10:52:52.107', NULL, '2026-07-27 10:52:52.108', '2026-07-27 10:52:54.443'),
('cms3454u3000fswf6wm2c9wat', 'process-comment', '{\"instagramAccountId\":\"37166246299687429\",\"commentId\":\"17975862404900413\",\"commentText\":\"سلام\",\"commenterId\":\"26216811814633132\",\"commenterName\":\"armin.reel\",\"mediaId\":\"17924684643158874\",\"source\":\"POLLING\"}', 'COMPLETED', 0, NULL, '2026-07-27 10:57:52.057', NULL, '2026-07-27 10:57:52.060', '2026-07-27 10:57:52.179'),
('cms34bkck000kswf6fe9wn1g1', 'process-comment', '{\"instagramAccountId\":\"37166246299687429\",\"commentId\":\"17975862404900413\",\"commentText\":\"سلام\",\"commenterId\":\"26216811814633132\",\"commenterName\":\"armin.reel\",\"mediaId\":\"17924684643158874\",\"source\":\"POLLING\"}', 'COMPLETED', 0, NULL, '2026-07-27 11:02:52.099', NULL, '2026-07-27 11:02:52.101', '2026-07-27 11:02:53.593');

-- --------------------------------------------------------

--
-- Table structure for table `ConversationState`
--

CREATE TABLE `ConversationState` (
  `id` varchar(191) NOT NULL,
  `workspaceId` varchar(191) NOT NULL,
  `instagramAccountId` varchar(191) NOT NULL,
  `userId` varchar(191) NOT NULL,
  `step` enum('IDLE','AWAITING_EMAIL','AWAITING_PHONE','COMPLETED') NOT NULL DEFAULT 'IDLE',
  `automationId` varchar(191) DEFAULT NULL,
  `isHumanHandover` tinyint(1) NOT NULL DEFAULT 0,
  `handoverAt` datetime(3) DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`metadata`)),
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  `lastInteractedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `CouponCode`
--

CREATE TABLE `CouponCode` (
  `id` varchar(191) NOT NULL,
  `poolId` varchar(191) NOT NULL,
  `code` varchar(191) NOT NULL,
  `isClaimed` tinyint(1) NOT NULL DEFAULT 0,
  `claimedByUserId` varchar(191) DEFAULT NULL,
  `claimedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `CouponPool`
--

CREATE TABLE `CouponPool` (
  `id` varchar(191) NOT NULL,
  `workspaceId` varchar(191) NOT NULL,
  `automationId` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `defaultCode` varchar(191) DEFAULT NULL,
  `isUniqueCodes` tinyint(1) NOT NULL DEFAULT 0,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `DeadLetterMessage`
--

CREATE TABLE `DeadLetterMessage` (
  `id` varchar(191) NOT NULL,
  `workspaceId` varchar(191) DEFAULT NULL,
  `source` varchar(191) NOT NULL,
  `payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`payload`)),
  `errorMessage` text DEFAULT NULL,
  `status` varchar(191) NOT NULL DEFAULT 'FAILED',
  `attempts` int(11) NOT NULL DEFAULT 1,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `DmLog`
--

CREATE TABLE `DmLog` (
  `id` varchar(191) NOT NULL,
  `workspaceId` varchar(191) NOT NULL,
  `automationId` varchar(191) NOT NULL,
  `instagramAccountId` varchar(191) NOT NULL,
  `commenterId` varchar(191) NOT NULL,
  `commenterName` varchar(191) DEFAULT NULL,
  `commentText` text NOT NULL,
  `commentId` varchar(191) NOT NULL,
  `matchedKeyword` varchar(191) DEFAULT NULL,
  `status` enum('PENDING','SENT','FAILED','SKIPPED_DEDUP','SKIPPED_RATE_LIMIT','SKIPPED_PLAN_LIMIT','SKIPPED_NO_MATCH') NOT NULL DEFAULT 'PENDING',
  `attempts` int(11) NOT NULL DEFAULT 0,
  `dmSentAt` datetime(3) DEFAULT NULL,
  `errorMessage` text DEFAULT NULL,
  `publicReplySentAt` datetime(3) DEFAULT NULL,
  `publicReplyError` text DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  `type` enum('COMMENT_REPLY','DIRECT_MESSAGE') NOT NULL DEFAULT 'COMMENT_REPLY'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `FaqItem`
--

CREATE TABLE `FaqItem` (
  `id` varchar(191) NOT NULL,
  `workspaceId` varchar(191) NOT NULL,
  `instagramAccountId` varchar(191) NOT NULL,
  `question` varchar(191) NOT NULL,
  `keywords` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`keywords`)),
  `answerText` text NOT NULL,
  `linkUrl` varchar(191) DEFAULT NULL,
  `order` int(11) NOT NULL DEFAULT 0,
  `isActive` tinyint(1) NOT NULL DEFAULT 1,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `FunnelEvent`
--

CREATE TABLE `FunnelEvent` (
  `id` varchar(191) NOT NULL,
  `workspaceId` varchar(191) NOT NULL,
  `automationId` varchar(191) DEFAULT NULL,
  `userId` varchar(191) NOT NULL,
  `stage` varchar(191) NOT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`metadata`)),
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `Giveaway`
--

CREATE TABLE `Giveaway` (
  `id` varchar(191) NOT NULL,
  `workspaceId` varchar(191) NOT NULL,
  `automationId` varchar(191) NOT NULL,
  `title` varchar(191) NOT NULL,
  `maxTicketsPerUser` int(11) NOT NULL DEFAULT 1,
  `totalEntries` int(11) NOT NULL DEFAULT 0,
  `drawnAt` datetime(3) DEFAULT NULL,
  `status` enum('ACTIVE','DRAWN','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `GiveawayParticipant`
--

CREATE TABLE `GiveawayParticipant` (
  `id` varchar(191) NOT NULL,
  `giveawayId` varchar(191) NOT NULL,
  `userId` varchar(191) NOT NULL,
  `username` varchar(191) DEFAULT NULL,
  `ticketNumber` int(11) NOT NULL,
  `entryTrigger` varchar(191) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `GiveawayWinner`
--

CREATE TABLE `GiveawayWinner` (
  `id` varchar(191) NOT NULL,
  `giveawayId` varchar(191) NOT NULL,
  `participantId` varchar(191) NOT NULL,
  `userId` varchar(191) NOT NULL,
  `username` varchar(191) DEFAULT NULL,
  `ticketNumber` int(11) NOT NULL,
  `winningRank` int(11) NOT NULL DEFAULT 1,
  `drawnAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `InstagramAccount`
--

CREATE TABLE `InstagramAccount` (
  `id` varchar(191) NOT NULL,
  `workspaceId` varchar(191) NOT NULL,
  `instagramId` varchar(191) NOT NULL,
  `username` varchar(191) NOT NULL,
  `name` varchar(191) DEFAULT NULL,
  `accessToken` text NOT NULL,
  `tokenExpiresAt` datetime(3) DEFAULT NULL,
  `webhookSubscribed` tinyint(1) NOT NULL DEFAULT 0,
  `connectedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `KnowledgeChunk`
--

CREATE TABLE `KnowledgeChunk` (
  `id` varchar(191) NOT NULL,
  `documentId` varchar(191) NOT NULL,
  `chunkIndex` int(11) NOT NULL,
  `content` text NOT NULL,
  `embedding` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`embedding`)),
  `tokenCount` int(11) NOT NULL DEFAULT 0,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `KnowledgeDocument`
--

CREATE TABLE `KnowledgeDocument` (
  `id` varchar(191) NOT NULL,
  `workspaceId` varchar(191) NOT NULL,
  `title` varchar(191) NOT NULL,
  `sourceType` varchar(191) NOT NULL,
  `sourceUrl` varchar(191) DEFAULT NULL,
  `content` text NOT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`metadata`)),
  `version` int(11) NOT NULL DEFAULT 1,
  `isApproved` tinyint(1) NOT NULL DEFAULT 1,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `Lead`
--

CREATE TABLE `Lead` (
  `id` varchar(191) NOT NULL,
  `workspaceId` varchar(191) NOT NULL,
  `instagramAccountId` varchar(191) NOT NULL,
  `userId` varchar(191) NOT NULL,
  `username` varchar(191) DEFAULT NULL,
  `name` varchar(191) DEFAULT NULL,
  `email` varchar(191) DEFAULT NULL,
  `phone` varchar(191) DEFAULT NULL,
  `sourceAutomationId` varchar(191) DEFAULT NULL,
  `customData` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`customData`)),
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `LeadForm`
--

CREATE TABLE `LeadForm` (
  `id` varchar(191) NOT NULL,
  `workspaceId` varchar(191) NOT NULL,
  `title` varchar(191) NOT NULL,
  `description` text DEFAULT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT 1,
  `fields` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`fields`)),
  `settings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`settings`)),
  `slug` varchar(191) NOT NULL,
  `viewCount` int(11) NOT NULL DEFAULT 0,
  `submitCount` int(11) NOT NULL DEFAULT 0,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `LeadFormSubmission`
--

CREATE TABLE `LeadFormSubmission` (
  `id` varchar(191) NOT NULL,
  `formId` varchar(191) NOT NULL,
  `workspaceId` varchar(191) NOT NULL,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`data`)),
  `ipAddress` varchar(191) DEFAULT NULL,
  `userAgent` text DEFAULT NULL,
  `referrer` varchar(191) DEFAULT NULL,
  `syncedToCrm` tinyint(1) NOT NULL DEFAULT 0,
  `crmLeadId` int(11) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `LinkClick`
--

CREATE TABLE `LinkClick` (
  `id` varchar(191) NOT NULL,
  `workspaceId` varchar(191) NOT NULL,
  `automationId` varchar(191) NOT NULL,
  `instagramAccountId` varchar(191) NOT NULL,
  `trackedLinkId` varchar(191) NOT NULL,
  `ipHash` varchar(191) DEFAULT NULL,
  `userAgent` varchar(191) DEFAULT NULL,
  `referrer` varchar(191) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `OperationalEvent`
--

CREATE TABLE `OperationalEvent` (
  `id` varchar(191) NOT NULL,
  `workspaceId` varchar(191) DEFAULT NULL,
  `source` enum('WORKER','TOKEN_REFRESH','HEALTH','SYSTEM') NOT NULL,
  `level` enum('INFO','WARNING','ERROR') NOT NULL DEFAULT 'INFO',
  `message` text NOT NULL,
  `payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`payload`)),
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `resolvedAt` datetime(3) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `OperationalEvent`
--

INSERT INTO `OperationalEvent` (`id`, `workspaceId`, `source`, `level`, `message`, `payload`, `createdAt`, `resolvedAt`) VALUES
('cms1wy16k0003swguct1wwd16', NULL, 'SYSTEM', 'INFO', 'Comment sweep \"new\" [(any word)]: 2 enqueued, 3 matched, 0 already replied', '{\"campaign\":\"new\",\"keywords\":\"(any word)\",\"matched\":3,\"alreadyReplied\":0,\"enqueued\":2,\"errors\":[]}', '2026-07-26 14:48:37.245', NULL),
('cms33ype7000bswf6v4uh959w', NULL, 'SYSTEM', 'INFO', 'Comment sweep \"1\" [سلام,op]: 2 enqueued, 2 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":2,\"alreadyReplied\":0,\"enqueued\":2,\"errors\":[]}', '2026-07-27 10:52:52.111', NULL),
('cms3454u8000hswf6h4hhko1q', NULL, 'SYSTEM', 'INFO', 'Comment sweep \"1\" [سلام,op]: 1 enqueued, 2 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":2,\"alreadyReplied\":0,\"enqueued\":1,\"errors\":[]}', '2026-07-27 10:57:52.064', NULL),
('cms34bkcr000mswf60bwzjvyd', NULL, 'SYSTEM', 'INFO', 'Comment sweep \"1\" [سلام,op]: 1 enqueued, 2 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":2,\"alreadyReplied\":0,\"enqueued\":1,\"errors\":[]}', '2026-07-27 11:02:52.108', NULL),
('cms3in3o80003swjvr6933v1r', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 17:43:44.984', NULL),
('cms3itj4r0005swjvjfj2ky4e', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 17:48:44.955', NULL),
('cms3izynr0007swjv5z9s4ivr', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 17:53:45.015', NULL),
('cms3j6e3u0009swjv0e2u3yf7', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 17:58:44.970', NULL),
('cms3jctkt000bswjv77mz4i0m', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 18:03:44.957', NULL),
('cms3jj917000dswjv5hd4cgpb', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 18:08:44.913', NULL),
('cms3jpoho000fswjv1guvyyjc', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 18:13:44.892', NULL),
('cms3jw4eg000hswjvrhmvnu6y', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 18:18:45.448', NULL),
('cms3k2jgw000jswjvtfjsohaq', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 18:23:44.912', NULL),
('cms3k8yy0000lswjvn1sxct37', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 18:28:44.904', NULL),
('cms3kfemj000nswjvywfjgmwy', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 18:33:45.163', NULL),
('cms3kltxr000pswjvxyr0okms', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 18:38:44.943', NULL),
('cms3ks9w2000rswjvojzlt4bv', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 18:43:45.554', NULL),
('cms3kyp1t000tswjvl8bxfkwo', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 18:48:45.137', NULL),
('cms3l54em000vswjvd63ywpyl', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 18:53:44.970', NULL),
('cms3lbk4z000xswjvoc2qt334', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 18:58:45.300', NULL),
('cms3lhzcf000zswjvan2kp563', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 19:03:44.943', NULL),
('cms3loetw0011swjv4dcyxft9', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 19:08:44.948', NULL),
('cms3luug60013swjvlorz6fl7', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 19:13:45.126', NULL),
('cms3m1aej0015swjv9q28w7hg', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 19:18:45.740', NULL),
('cms3m7p980017swjv76us6hpd', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 19:23:44.924', NULL),
('cms3me4t80019swjvzkr2uzwo', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 19:28:45.021', NULL),
('cms3mkk8l001bswjvic2hi73o', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 19:33:44.949', NULL),
('cms3mqzpz001dswjvds38l934', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 19:38:44.951', NULL),
('cms3mxf6j001fswjvyyfgctcy', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 19:43:44.923', NULL),
('cms3n3uqd001hswjvpi5acjcj', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 19:48:45.013', NULL),
('cms3naa5j001jswjvipgc4s6s', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 19:53:44.935', NULL),
('cms3ngpn2001lswjvi9g5kjo4', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 19:58:44.942', NULL),
('cms3nn55o001nswjvstvu3skw', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 20:03:44.988', NULL),
('cms3ntkml001pswjv27dq3eg9', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 20:08:44.973', NULL),
('cms3o005h001rswjvs5dni10w', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 20:13:45.029', NULL),
('cms3o6fo2001tswjvnqju5k5r', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 20:18:45.032', NULL),
('cms3ocvdt001vswjv01rkd802', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 20:23:45.340', NULL),
('cms3ojamg001xswjvdyl8r9qg', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 20:28:45.064', NULL),
('cms3opq2g001zswjv4c9vt2o3', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 20:33:45.016', NULL),
('cms3ow59b0021swjv43ic8x0d', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 20:38:44.639', NULL),
('cms3p2kkh0023swjvc0i8pz25', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 20:43:44.417', NULL),
('cms3p90450025swjvogyycu2e', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 20:48:44.501', NULL),
('cms3pffjp0027swjvcwso45dh', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 20:53:44.437', NULL),
('cms3plv1i0029swjvihttv453', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 20:58:44.454', NULL),
('cms3psaju002bswjvlfg4t1gy', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 21:03:44.491', NULL),
('cms3pyq0v002dswjvgetd74fs', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 21:08:44.479', NULL),
('cms3q55g8002fswjvv6801nof', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 21:13:44.408', NULL),
('cms3qbl0a002hswjvfuwgetzb', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 21:18:44.507', NULL),
('cms3qi0gv002jswjvhztm03vz', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 21:23:44.479', NULL),
('cms3qofzj002lswjvl476uftx', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 21:28:44.527', NULL),
('cms3quvzs002nswjv02blcvne', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 21:33:45.208', NULL),
('cms3r1aya002pswjvpi2k3va7', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 21:38:44.530', NULL),
('cms3r7qd7002rswjvkn5hlwlf', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 21:43:44.441', NULL),
('cms3re5xm002tswjvot0on49p', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 21:48:44.537', NULL),
('cms3rklc2002vswjvec78bfml', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 21:53:44.450', NULL),
('cms3rr0th002xswjv9jnqucod', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 21:58:44.453', NULL),
('cms3rxg9y002zswjvgi2t9q4v', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 22:03:44.423', NULL),
('cms3s3vwf0031swjvv8dgtw90', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 22:08:44.607', NULL),
('cms3sab9l0033swjvuysaiigc', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 22:13:44.458', NULL),
('cms3sgqs10035swjvaz46l1mb', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 22:18:44.497', NULL),
('cms3sn67m0037swjv8jucype6', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 22:23:44.434', NULL),
('cms3stlqb0039swjvgqph7c0j', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 22:28:44.483', NULL),
('cms3t017v003bswjvfy9rkjab', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 22:33:44.491', NULL),
('cms3t6gp5003dswjvzzui0qkz', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 22:38:44.489', NULL),
('cms3tcwa4003fswjvgcn99oun', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 22:43:44.620', NULL),
('cms3tjc1u003hswjvvf5kjuha', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 22:48:44.994', NULL),
('cms3tpr4k003jswjviyy4e4m3', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 22:53:44.468', NULL),
('cms3tw6n2003lswjv0oks4qpu', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 22:58:44.510', NULL),
('cms3u2m2h003nswjvw0g16279', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 23:03:44.441', NULL),
('cms3u91mn003pswjvdrszwa51', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 23:08:44.543', NULL),
('cms3ufh2p003rswjvopmo76q7', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 23:13:44.491', NULL),
('cms3ulwl8003tswjvvk8t4gt1', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 23:18:44.500', NULL),
('cms3usc0i003vswjvineu3crn', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 23:23:44.467', NULL),
('cms3uyrl3003xswjvhrk0uniq', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 23:28:44.583', NULL),
('cms3v56yr003zswjvwf0m3j6x', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 23:33:44.452', NULL),
('cms3vbmhw0041swjv96rt3ayp', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 23:38:44.517', NULL),
('cms3vi1ye0043swjvpraks9wz', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 23:43:44.486', NULL),
('cms3vohgd0045swjv47855d37', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 23:48:44.509', NULL),
('cms3vuwx20047swjv7mounc4y', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 23:53:44.486', NULL),
('cms3w1cfa0049swjviyt0ox0x', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-27 23:58:44.518', NULL),
('cms3w7rz5004bswjv62omoub0', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 00:03:44.609', NULL),
('cms3we7ig004dswjv1a5u4us2', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 00:08:44.680', NULL),
('cms3wkmw0004fswjvx425elw9', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 00:13:44.529', NULL),
('cms3wr2cy004hswjvvax3bfmp', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 00:18:44.531', NULL),
('cms3wxht4004jswjvznsjixqb', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 00:23:44.488', NULL),
('cms3x3xb8004lswjvpj0vqmjt', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 00:28:44.516', NULL),
('cms3xact5004nswjvv4oeqwa2', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 00:33:44.538', NULL),
('cms3xgs9y004pswjvwwiurr7b', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 00:38:44.519', NULL),
('cms3xn7qe004rswjv96id55nw', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 00:43:44.487', NULL),
('cms3xtn99004tswjvlozgihw7', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 00:48:44.542', NULL),
('cms3y02qc004vswjvgtp3cibc', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 00:53:44.532', NULL),
('cms3y6i7j004xswjvqnqfm605', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 00:58:44.527', NULL),
('cms3ycxom004zswjvii9ahfzf', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 01:03:44.518', NULL),
('cms3yjd7s0051swjvvjhfia74', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 01:08:44.584', NULL),
('cms3ypspg0053swjvlz4m8jzi', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 01:13:44.596', NULL),
('cms3yw8au0055swjvb9i1292k', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 01:18:44.742', NULL),
('cms3z2nnj0057swjvcjsxa146', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 01:23:44.575', NULL),
('cms3z936x0059swjveydnzmhw', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 01:28:44.649', NULL),
('cms3zfikp005bswjvrzthogs8', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 01:33:44.522', NULL),
('cms3zly4d005dswjvcs9u3cqf', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 01:38:44.605', NULL),
('cms3zsdj3005fswjvyleeoqvo', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 01:43:44.511', NULL),
('cms3zyt27005hswjvpue42i26', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 01:48:44.575', NULL),
('cms4058j4005jswjvdpysam73', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 01:53:44.560', NULL),
('cms40bogg005lswjvie6740pj', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 01:58:45.137', NULL),
('cms40i3gl005nswjv7qukpisd', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 02:03:44.517', NULL),
('cms40oj2g005pswjv65wehtij', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 02:08:44.680', NULL),
('cms40uyfy005rswjv62a33xlr', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 02:13:44.542', NULL),
('cms411dy1005tswjvnyu0c2a1', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 02:18:44.570', NULL),
('cms417tf6005vswjvm148otaz', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 02:23:44.562', NULL),
('cms41e8z7005xswjvodwnr67t', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 02:28:44.659', NULL),
('cms41koh4005zswjvuh9uyz1s', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 02:33:44.680', NULL),
('cms41r3vu0061swjvtcbourgq', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 02:38:44.587', NULL),
('cms41xjbx0063swjvrho4wsf3', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 02:43:44.542', NULL),
('cms423yyy0065swjv65t9bikj', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 02:48:44.746', NULL),
('cms42aebn0067swjv4ipsecor', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 02:53:44.579', NULL),
('cms42gtvm0069swjv9rf1uo0v', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 02:58:44.674', NULL),
('cms42n9cn006bswjvz2zdo8zx', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 03:03:44.663', NULL),
('cms42tos4006dswjvfl743hh6', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 03:08:44.596', NULL),
('cms43048o006fswjvd3knal7t', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 03:13:44.568', NULL),
('cms436jrh006hswjv8zfeq1kw', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 03:18:44.621', NULL),
('cms43cz7l006jswjvgqyln55z', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 03:23:44.578', NULL),
('cms43jeoo006lswjvwz39f6jf', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 03:28:44.568', NULL),
('cms43pu6q006nswjvwscm35st', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: fetch failed\"]}', '2026-07-28 03:33:44.594', NULL),
('cms43waw5006pswjvmuuknlke', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 03:38:46.181', NULL),
('cms442p5r006rswjvki95ucph', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 03:43:44.608', NULL),
('cms4494o5006tswjvewgh2pd9', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 03:48:44.645', NULL),
('cms44fk78006vswjvgnc0n7fw', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 03:53:44.708', NULL),
('cms44lzoc006xswjvxfls9669', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 03:58:44.643', NULL),
('cms44sf4w006zswjvrfyiyb3z', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 04:03:44.620', NULL),
('cms44yukf0071swjvzzpl2teq', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 04:08:44.607', NULL),
('cms455a1s0073swjvrq870aj6', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 04:13:44.609', NULL),
('cms45bpm20075swjvgynn5iqa', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 04:18:44.711', NULL),
('cms45i4zu0077swjvv2lu4e4r', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 04:23:44.586', NULL),
('cms45okhv0079swjvz0njtwrt', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 04:28:44.611', NULL),
('cms45uzyw007bswjvvqhc4v99', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 04:33:44.600', NULL),
('cms461fio007dswjvo9rlkf0g', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 04:38:44.688', NULL),
('cms467uy7007fswjvzs46ugeh', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 04:43:44.623', NULL),
('cms46eagf007hswjv1uinpi0w', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 04:48:44.655', NULL),
('cms46kpx1007jswjviaaef9rq', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 04:53:44.629', NULL),
('cms46r5h0007lswjvg91ip0pv', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 04:58:44.724', NULL),
('cms46xkv4007nswjv6qi8gldx', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 05:03:44.609', NULL),
('cms4740fk007pswjvglqv9exu', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 05:08:44.671', NULL),
('cms47afu2007rswjvwpfitsx9', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 05:13:44.618', NULL),
('cms47gvf8007tswjvtwb28bzb', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 05:18:44.756', NULL),
('cms47nat7007vswjvvbjco1yu', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 05:23:44.635', NULL),
('cms47tqcp007xswjv5ubsfakb', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 05:28:44.713', NULL),
('cms4805s4007zswjvlc7v0r8c', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 05:33:44.644', NULL),
('cms486lag0081swjvoddid94f', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 05:38:44.680', NULL);
INSERT INTO `OperationalEvent` (`id`, `workspaceId`, `source`, `level`, `message`, `payload`, `createdAt`, `resolvedAt`) VALUES
('cms48d0qn0083swjvy6ukf207', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 05:43:44.639', NULL),
('cms48jg9h0085swjv1frh8kr5', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 05:48:44.694', NULL),
('cms48pvpx0087swjvcol0d6bn', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 05:53:44.661', NULL),
('cms48wb800089swjvybtxwhpd', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 05:58:44.688', NULL),
('cms492qov008bswjvn0wvby1g', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 06:03:44.672', NULL),
('cms49966e008dswjvolalzmb8', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 06:08:44.678', NULL),
('cms49flmr008fswjvf513a666', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 06:13:44.643', NULL),
('cms49m16t008hswjvi8vm1yeg', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 06:18:44.741', NULL),
('cms49sgm9008jswjvlu0vgx9n', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 06:23:44.673', NULL),
('cms49yw6b008lswjvfubyoa2u', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 06:28:44.771', NULL),
('cms4a5bnx008nswjvazfq0kda', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 06:33:44.781', NULL),
('cms4abr3j008pswjvkypee2ib', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 06:38:44.719', NULL),
('cms4ai6pd008rswjvh8z9jpj1', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 06:43:44.878', NULL),
('cms4aom10008tswjv63708lzv', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 06:48:44.677', NULL),
('cms4av1iw008vswjv6etkmd1p', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 06:53:44.697', NULL),
('cms4b1h03008xswjvhee0vzdu', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 06:58:44.691', NULL),
('cms4b7whd008zswjv3u8pbmz1', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 07:03:44.689', NULL),
('cms4bec6d0091swjv43tnukut', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 07:08:44.965', NULL),
('cms4bkrfn0093swjvdznaoj87', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 07:13:44.675', NULL),
('cms4br6yl0095swjvk18ppg7o', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 07:18:44.733', NULL),
('cms4bxmeg0097swjvnvscbx7m', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 07:23:44.680', NULL),
('cms4c42qz0099swjvuhp16zz4', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 07:28:45.803', NULL),
('cms4caheo009bswjv2rmvsml1', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 07:33:44.736', NULL),
('cms4cgwx9009dswjvxza8uyk3', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 07:38:44.781', NULL),
('cms4cncfd009fswjvwhqacuo1', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 07:43:44.810', NULL),
('cms4cts26009hswjvrtuwi0re', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 07:48:45.006', NULL),
('cms4d07df009jswjvjkcqsl6m', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 07:53:44.765', NULL),
('cms4d6mum009lswjv1ki38pu4', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 07:58:44.783', NULL),
('cms4dd2c3009nswjvlq8bw0q9', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 08:03:44.764', NULL),
('cms4djht3009pswjvy623fz1a', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 08:08:44.775', NULL),
('cms4dpx9z009rswjv1fmwbq1i', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 08:13:44.760', NULL),
('cms4dwcya009tswjv4h6vq3g6', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 08:18:45.010', NULL),
('cms4e2sab009vswjvm6vkwzrq', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 08:23:44.819', NULL),
('cms4e97rb009xswjv71datx7p', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 08:28:44.807', NULL),
('cms4efn6h009zswjvxczfot2b', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 08:33:44.730', NULL),
('cms4em2pm00a1swjvnwdlrvce', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 08:38:44.794', NULL),
('cms4esi6q00a3swjvnoyl3a6v', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 08:43:44.786', NULL),
('cms4eyxoo00a5swjvkyl5r7dh', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 08:48:44.809', NULL),
('cms4f5d6i00a7swjv0cv6us6f', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 08:53:44.826', NULL),
('cms4fbsmp00a9swjvoinsh7we', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 08:58:44.785', NULL),
('cms4fi83y00abswjvf68ofsim', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 09:03:44.782', NULL),
('cms4fonme00adswjviv8zc0f7', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 09:08:44.822', NULL),
('cms4fv32l00afswjv06umm9pv', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 09:13:44.781', NULL),
('cms4g1il400ahswjv870u0gdo', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 09:18:44.824', NULL),
('cms4g7y1d00ajswjvn6ogzilo', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 09:23:44.785', NULL),
('cms4gedk300alswjv5u64wt7k', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 09:28:44.835', NULL),
('cms4gkt1d00answjvss2m7c0t', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 09:33:44.833', NULL),
('cms4gr8hu00apswjvtzzuji7t', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 09:38:44.802', NULL),
('cms4gxnz000arswjv7s4t93yl', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 09:43:44.796', NULL),
('cms4h43hv00atswjvaxpzm5wh', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 09:48:44.851', NULL),
('cms4haixn00avswjv0ln27ve1', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 09:53:44.795', NULL),
('cms4hgyfl00axswjvrt6cnijt', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 09:58:44.817', NULL),
('cms4hndwd00azswjv52x3og3i', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 10:03:44.797', NULL),
('cms4htte300b1swjvs29i4k9n', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 10:08:44.811', NULL),
('cms4i08v900b3swjv6za4fcvt', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 10:13:44.805', NULL),
('cms4i6oe200b5swjvj0z640n6', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 10:18:44.858', NULL),
('cms4id3u500b7swjvh08dcx1b', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 10:23:44.813', NULL),
('cms4ijjbg00b9swjvx3cpmje1', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 10:28:44.812', NULL),
('cms4ipyt400bbswjvjk6zqqb5', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 10:33:44.824', NULL),
('cms4iwea600bdswjvadj2m1gz', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 10:38:44.814', NULL),
('cms4j2trf00bfswjvysj4nm12', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 10:43:44.812', NULL),
('cms4j99am00bhswjvkche33tm', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 10:48:44.878', NULL),
('cms4jfos800bjswjvqhiwgn7s', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 10:53:44.888', NULL),
('cms4jm49v00blswjv9y01k1du', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 10:58:44.887', NULL),
('cms4jsjon00bnswjvk5ojaisd', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 11:03:44.807', NULL),
('cms4jyzao00bpswjvyz9z3rj2', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 11:08:44.976', NULL),
('cms4k5eoo00brswjvhe9i7uoa', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 11:13:44.856', NULL),
('cms4kbu6p00btswjvtp8a0dr5', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 11:18:44.882', NULL),
('cms4ki9m100bvswjvif6a0liq', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 11:23:44.810', NULL),
('cms4kopbl00bxswjvx4bvxgvl', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 11:28:45.023', NULL),
('cms4kv4p100bzswjvfkh93k44', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 11:33:44.918', NULL),
('cms4l1k6100c1swjv5qtidjht', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 11:38:44.953', NULL),
('cms4l7zjv00c3swjvjke9lq8h', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 11:43:44.825', NULL),
('cms4lef3f00c5swjvtnk8gxux', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 11:48:44.882', NULL),
('cms4lkujw00c7swjv2qg7eujy', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 11:53:44.876', NULL),
('cms4lra2200c9swjv7w9ahtqp', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 11:58:44.906', NULL),
('cms4lxpju00cbswjv5i1kt5q4', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 12:03:44.922', NULL),
('cms4m44zu00cdswjve0glp11z', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 12:08:44.874', NULL),
('cms4makhy00cfswjvqkma8v34', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 12:13:44.902', NULL),
('cms4mh00y00chswjv33gmq4w6', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 12:18:44.963', NULL),
('cms4mnfih00cjswjvdmxylhak', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 12:23:44.969', NULL),
('cms4mtuxz00clswjvxzy7qrbq', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 12:28:44.903', NULL),
('cms4n0aef00cnswjvf74jx03h', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 12:33:44.871', NULL),
('cms4n6pz900cpswjva05iryk9', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 12:38:44.997', NULL),
('cms4nd5ca00crswjv1s3l2xh8', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 12:43:44.842', NULL),
('cms4njkv500ctswjv010piffz', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 12:48:44.878', NULL),
('cms4nq0ar00cvswjvytcwkver', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 12:53:44.836', NULL),
('cms4nwfwt00cxswjv4efgre9w', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 12:58:44.962', NULL),
('cms4o2vbd00czswjvq91a4s5q', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 13:03:44.906', NULL),
('cms4o9asb00d1swjvobzfpp63', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 13:08:44.891', NULL),
('cms4ofq8t00d3swjvk0l2f9a7', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 13:13:44.861', NULL),
('cms4om5sb00d5swjvnswfda0g', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 13:18:44.939', NULL),
('cms4osl8o00d7swjvaijud2c6', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 13:23:44.904', NULL),
('cms4oz0rs00d9swjvj3ecvru2', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 13:28:44.968', NULL),
('cms4p5g8300dbswjv80ekl0uk', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 13:33:44.931', NULL),
('cms4pbvst00ddswjvh4mjip1d', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 13:38:45.053', NULL),
('cms4pib6100dfswjvm8nbqaf6', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 13:43:44.906', NULL),
('cms4poqpo00dhswjvcxoe42iu', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 13:48:44.989', NULL),
('cms4pv66j00djswjv75p9x3kr', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 13:53:44.971', NULL),
('cms4q1lnj00dlswjvuj6a1qhx', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 13:58:44.959', NULL),
('cms4q813600dnswjvzg11jhty', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 14:03:44.898', NULL),
('cms4qegl700dpswjv3r9z27c8', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 14:08:44.923', NULL),
('cms4qkw2400drswjv22ene6fh', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 14:13:44.908', NULL),
('cms4qrbll00dtswjvuytdtatd', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 14:18:44.985', NULL),
('cms4qxr0n00dvswjvq1rflfhh', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 14:23:44.904', NULL),
('cms4r46iv00dxswjvrp8ag6w3', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 14:28:44.935', NULL),
('cms4ram0z00dzswjv1rxh5pua', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 14:33:44.963', NULL),
('cms4rh1ji00e1swjvqfonys1k', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 14:38:45.006', NULL),
('cms4rngxl00e3swjv5jhutu2i', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 14:43:44.889', NULL),
('cms4rtwht00e5swjvzh8ivj1v', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 14:48:44.994', NULL),
('cms4s0bxn00e7swjvjv4fcqkx', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 14:53:44.939', NULL),
('cms4s6rez00e9swjvti5aoxvk', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 14:58:44.940', NULL),
('cms4sd6vo00ebswjvnvyvq3h7', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 15:03:44.917', NULL),
('cms4sjmf600edswjv1sbblxzs', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 15:08:44.991', NULL),
('cms4sq1to00efswjv0kv5whig', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 15:13:44.892', NULL),
('cms4swhej00ehswjvfg3v6ib1', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 15:18:45.019', NULL),
('cms4t2wsk00ejswjvx4vn7bwq', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 15:23:44.901', NULL),
('cms4t9cd900elswjv29drdewm', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 15:28:45.021', NULL),
('cms4tfrr900enswjv4fzsv5ol', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 15:33:44.901', NULL),
('cms4tm7am00epswjv87gd3jy3', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 15:38:44.974', NULL),
('cms4tsmpz00erswjvshdhd0rw', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 15:43:44.903', NULL),
('cms4tz29600etswjvbikldqvr', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 15:48:44.970', NULL),
('cms4u5hqg00evswjvcvl1p831', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 15:53:44.968', NULL),
('cms4ubx6n00exswjvzt8d7pka', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 15:58:44.928', NULL),
('cms4uicqn00ezswjvqxwguhvu', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 16:03:45.023', NULL),
('cms4uos8k00f1swjvtvllmmw4', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 16:08:45.044', NULL),
('cms4uv9pb00f3swjvfqdf4adc', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 16:13:47.615', NULL),
('cms4v1n3l00f5swjv2kglhef9', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 16:18:44.913', NULL),
('cms4v82mf00f7swjvu3l9vcao', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 16:23:44.967', NULL),
('cms4vei3700f9swjv1i6018xs', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 16:28:44.947', NULL),
('cms4vkxl600fbswjv6qu5jx7f', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 16:33:44.970', NULL),
('cms4vrd2u00fdswjvqkf57vhr', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 16:38:44.982', NULL),
('cms4vxsj300ffswjv1ut1idmz', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 16:43:44.943', NULL),
('cms4w482e00fhswjvoqtrkuh0', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 16:48:45.014', NULL),
('cms4wanif00fjswjveigpcz3v', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 16:53:44.968', NULL),
('cms4wh2ym00flswjvqgf585ea', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 16:58:44.926', NULL),
('cms4wnii200fnswjvd5rbjwtl', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 17:03:45.002', NULL),
('cms4wty2700fpswjvtx4xyo1h', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 17:08:45.103', NULL),
('cms4x0dgb00frswjv93w8wvxm', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 17:13:44.987', NULL),
('cms4x6szr00ftswjvqj4f6k6m', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 17:18:45.035', NULL),
('cms4xd8eq00fvswjvsl39klce', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 17:23:44.978', NULL),
('cms4xjnwq00fxswjvjbr1zs4d', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 17:28:44.976', NULL),
('cms4xq3dy00fzswjvtycncq1h', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 17:33:44.999', NULL),
('cms4xwixs00g1swjvwy4ece5u', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 17:38:45.089', NULL),
('cms4y2ycy00g3swjv58s4f21k', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 17:43:45.011', NULL),
('cms4y9dwt00g5swjvb7mwedin', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 17:48:45.102', NULL),
('cms4yftds00g7swjv8e8h8tjc', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 17:53:45.088', NULL);
INSERT INTO `OperationalEvent` (`id`, `workspaceId`, `source`, `level`, `message`, `payload`, `createdAt`, `resolvedAt`) VALUES
('cms4ym8uw00g9swjvr57bo1w3', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 17:58:45.065', NULL),
('cms4ysoa000gbswjvke7fhfeq', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 18:03:45.001', NULL),
('cms4yz3sx00gdswjvs2xnsu2o', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 18:08:45.058', NULL),
('cms4z5j8k00gfswjvc22jufn9', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 18:13:44.996', NULL),
('cms4zbyqg00ghswjv3fvveb08', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 18:18:45.017', NULL),
('cms4zie6u00gjswjvsy1afbxy', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 18:23:44.982', NULL),
('cms4zotrg00glswjvt3tirkrr', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 18:28:45.100', NULL),
('cms4zv96n00gnswjv0epf8tow', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 18:33:45.023', NULL),
('cms501opa00gpswjvy0sfh3ro', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 18:38:45.070', NULL),
('cms50844p00grswjvcycivtjn', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 18:43:45.001', NULL),
('cms50ejm900gtswjvpsynd97y', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 18:48:45.009', NULL),
('cms50kz5u00gvswjvfqtrsk9i', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 18:53:45.090', NULL),
('cms50relr00gxswjvkhijhnxa', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 18:58:45.040', NULL),
('cms50xu3x00gzswjvadospf7m', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 19:03:45.069', NULL),
('cms5149mn00h1swjvrt8tpvhy', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 19:08:45.119', NULL),
('cms51ap2h00h3swjvz6lpwptg', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 19:13:45.065', NULL),
('cms51h4n000h5swjvkpihkvxy', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 19:18:45.181', NULL),
('cms51nk1r00h7swjvn2tr2lew', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 19:23:45.088', NULL),
('cms51tzkg00h9swjvtlkvsqio', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 19:28:45.095', NULL),
('cms520f0x00hbswjvtyolxvzz', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 19:33:45.105', NULL),
('cms526uil00hdswjv4hphrwhs', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 19:38:45.118', NULL),
('cms52d9yd00hfswjv0ks1ws1k', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 19:43:45.061', NULL),
('cms52jpgn00hhswjvvf527mg7', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 19:48:45.095', NULL),
('cms52q4y100hjswjv1bcrnzuk', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 19:53:45.097', NULL),
('cms52wkff00hlswjvmbkza70r', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 19:58:45.099', NULL),
('cms532zwv00hnswjvrb5gpn59', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 20:03:45.103', NULL),
('cms539fek00hpswjvd8szz5m0', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 20:08:45.116', NULL),
('cms53fut700hrswjvdj3x00wo', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 20:13:45.019', NULL),
('cms53mabv00htswjvjkr9te4f', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 20:18:45.067', NULL),
('cms53spum00hvswjvixxvohtv', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 20:23:45.118', NULL),
('cms53z5hw00hxswjvrzau2hk3', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 20:28:45.332', NULL),
('cms545kqs00hzswjvldctv3t3', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 20:33:45.028', NULL),
('cms54c06u00i1swjv57u08kik', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 20:38:44.982', NULL),
('cms54ifys00i3swjv7pnijcrp', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 20:43:45.104', NULL),
('cms54ov5j00i5swjvwphtoxmg', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 20:48:44.983', NULL),
('cms54vftd00i7swjv9qtmd2gy', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 20:53:51.697', NULL),
('cms551q3d00i9swjv9yh3vtrr', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 20:58:44.953', NULL),
('cms5585mp00ibswjv5d1t54zj', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 21:03:45.025', NULL),
('cms55el2a00idswjv5v5cjbu2', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 21:08:44.962', NULL),
('cms55l0j100ifswjvgviagl75', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 21:13:44.942', NULL),
('cms55rg1b00ihswjv3axc9hmc', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 21:18:44.975', NULL),
('cms55xvj500ijswjvqvko60at', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 21:23:44.994', NULL),
('cms564b0200ilswjvuaqo5a1y', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 21:28:44.978', NULL),
('cms56aqhs00inswjv5y894p3q', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 21:33:44.992', NULL),
('cms56h5z000ipswjv8jgt8px6', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 21:38:44.988', NULL),
('cms56nlrc00irswjvrnmkzqwf', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 21:43:45.384', NULL),
('cms56u0z400itswjvasycnof2', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 21:48:45.040', NULL),
('cms570gef00ivswjvk8s1z8r7', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 21:53:44.967', NULL),
('cms576vvg00ixswjvnqqqb61o', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 21:58:44.956', NULL),
('cms57dbcw00izswjvpfrcb7vs', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 22:03:44.960', NULL),
('cms57jqwd00j1swjvmm7pjsct', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 22:08:45.037', NULL),
('cms57q6bk00j3swjvy1ma9a81', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 22:13:44.960', NULL),
('cms57wltg00j5swjvjnyg908c', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 22:18:44.980', NULL),
('cms5831at00j7swjv6lzryco7', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 22:23:44.981', NULL),
('cms589gtl00j9swjvcimhgd0u', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 22:28:45.033', NULL),
('cms58fw9f00jbswjvh6cx5mhn', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 22:33:44.980', NULL),
('cms58mbrt00jdswjvh0xgc8kq', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 22:38:45.017', NULL),
('cms58sr8q00jfswjv6rvxuo2s', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 22:43:45.002', NULL),
('cms58z6pm00jhswjv5wz5ftyu', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 22:48:44.986', NULL),
('cms595m7r00jjswjvd0jhncpl', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 22:53:45.015', NULL),
('cms59c1nt00jlswjvn03av65d', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 22:58:44.969', NULL),
('cms59ih7100jnswjvrv2jf2f7', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 23:03:45.037', NULL),
('cms59owmr00jpswjvix4guz76', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 23:08:44.979', NULL),
('cms59vc4t00jrswjvbp8f9sej', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 23:13:45.005', NULL),
('cms5a1rm300jtswjvpfn0emjg', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 23:18:45.003', NULL),
('cms5a873g00jvswjv94artjcx', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 23:23:45.004', NULL),
('cms5aemls00jxswjvy57vy4yw', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 23:28:45.040', NULL),
('cms5al21w00jzswjv6sj72fys', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 23:33:44.996', NULL),
('cms5arhn800k1swjvnurfwki5', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 23:38:45.140', NULL),
('cms5axx0u00k3swjvo25j73it', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 23:43:45.006', NULL),
('cms5b4cmd00k5swjvch4j8p2s', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 23:48:45.099', NULL),
('cms5bas0i00k7swjvf5fbl4oj', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 23:53:45.042', NULL),
('cms5bh7om00k9swjvuy6gqlac', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-28 23:58:45.113', NULL),
('cms5bnn1800kbswjvo0lk7ko2', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-29 00:03:45.117', NULL),
('cms5bu2gm00kdswjvi04z6um5', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-29 00:08:45.046', NULL),
('cms5c0hyb00kfswjvvlki4nne', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-29 00:13:45.059', NULL),
('cms5c6xh700khswjvqriz6n3s', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-29 00:18:45.115', NULL),
('cms5cdcwz00kjswjvlobygh71', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-29 00:23:45.059', NULL),
('cms5cjsdw00klswjvb1rcb5qq', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-29 00:28:45.044', NULL),
('cms5cq7we00knswjvfxk50qlc', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-29 00:33:45.087', NULL),
('cms5cwnde00kpswjvvx6fvuix', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-29 00:38:45.074', NULL),
('cms5d32ur00krswjvw0nn8uhf', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-29 00:43:45.075', NULL),
('cms5d9ic100ktswjv7j19pnk1', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: fetch failed\"]}', '2026-07-29 00:48:45.073', NULL),
('cms5dfxsx00kvswjvyjkk1t65', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-29 00:53:45.057', NULL),
('cms5dmdbe00kxswjvwi53kvqt', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-29 00:58:45.098', NULL),
('cms5dssse00kzswjvh9h5rxfa', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-29 01:03:45.086', NULL),
('cms5dz89a00l1swjvy27y6wva', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-29 01:08:45.071', NULL),
('cms5e5nqv00l3swjvuv4wfl5z', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-29 01:13:45.080', NULL),
('cms5ec36o00l5swjvm8crsg90', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-29 01:18:45.025', NULL),
('cms5eiikv00l7swjvqd0088fz', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-29 01:23:44.911', NULL),
('cms5eoy6k00l9swjv1yrcc8ej', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-29 01:28:45.068', NULL),
('cms5evi2r00lbswjvyx85uc5v', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-29 01:33:50.787', NULL),
('cms5f1t5h00ldswjv6bzv88sp', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-29 01:38:45.077', NULL),
('cms5f88q700lfswjvxea33gqr', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-29 01:43:45.200', NULL),
('cms5feo3m00lhswjvtir3k6jj', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-29 01:48:45.058', NULL),
('cms5fl3lg00ljswjv1xxqqrc7', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-29 01:53:45.077', NULL),
('cms5frj2o00llswjv5gysiw7r', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-29 01:58:45.072', NULL),
('cms5fxymz00lnswjv720aukpe', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-29 02:03:45.179', NULL),
('cms5g4hsh00lpswjv1k31edye', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-29 02:08:49.937', NULL),
('cms5gav8q00lrswjvnr3eimt8', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-29 02:13:47.306', NULL),
('cms5ghc2500ltswjveqrzd0p0', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-29 02:18:49.037', NULL),
('cms5gnpl400lvswjvim6zice2', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-29 02:23:46.504', NULL),
('cms5gu3z500lxswjvab6sjqtp', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-29 02:28:45.090', NULL),
('cms5h0jfx00lzswjv2yztsxue', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-29 02:33:45.069', NULL),
('cms5h72cc00m1swjvi4gtbq62', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-29 02:38:49.500', NULL),
('cms5hdi6h00m3swjveff2kzok', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-29 02:43:49.961', NULL),
('cms5hjxnz00m5swjv6h3mgqx5', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-29 02:48:49.958', NULL),
('cms5hq9dp00m7swjvhwd6nsim', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-29 02:53:45.085', NULL),
('cms5hwouw00m9swjvt8jmensi', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-29 02:58:45.080', NULL),
('cms5i34ce00mbswjv39fjxpy6', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-29 03:03:45.086', NULL),
('cms5i9jy400mdswjvr3bur14y', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-29 03:08:45.244', NULL),
('cms5ifzan00mfswjvnpqkjdq7', NULL, 'SYSTEM', 'WARNING', 'Comment sweep \"1\" [سلام,op]: 0 enqueued, 0 matched, 0 already replied', '{\"campaign\":\"1\",\"keywords\":\"سلام,op\",\"matched\":0,\"alreadyReplied\":0,\"enqueued\":0,\"errors\":[\"Comments 17924684643158874: Meta 100: API access blocked.\"]}', '2026-07-29 03:13:45.072', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `ProcessedComment`
--

CREATE TABLE `ProcessedComment` (
  `id` varchar(191) NOT NULL,
  `instagramAccountId` varchar(191) NOT NULL,
  `commentId` varchar(191) NOT NULL,
  `source` varchar(191) NOT NULL,
  `seenAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ProcessedMessage`
--

CREATE TABLE `ProcessedMessage` (
  `id` varchar(191) NOT NULL,
  `instagramAccountId` varchar(191) NOT NULL,
  `mid` varchar(191) NOT NULL,
  `source` varchar(191) NOT NULL,
  `seenAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `Session`
--

CREATE TABLE `Session` (
  `id` varchar(191) NOT NULL,
  `sessionToken` varchar(191) NOT NULL,
  `userId` varchar(191) NOT NULL,
  `expires` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `SystemFeatureFlag`
--

CREATE TABLE `SystemFeatureFlag` (
  `id` varchar(191) NOT NULL,
  `workspaceId` varchar(191) DEFAULT NULL,
  `featureKey` varchar(191) NOT NULL,
  `isEnabled` tinyint(1) NOT NULL DEFAULT 1,
  `config` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`config`)),
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `TrackedLink`
--

CREATE TABLE `TrackedLink` (
  `id` varchar(191) NOT NULL,
  `workspaceId` varchar(191) NOT NULL,
  `automationId` varchar(191) NOT NULL,
  `slug` varchar(191) NOT NULL,
  `label` varchar(191) DEFAULT NULL,
  `destinationUrl` varchar(191) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `User`
--

CREATE TABLE `User` (
  `id` varchar(191) NOT NULL,
  `name` varchar(191) DEFAULT NULL,
  `email` varchar(191) DEFAULT NULL,
  `emailVerified` datetime(3) DEFAULT NULL,
  `image` varchar(191) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  `passwordHash` varchar(191) DEFAULT NULL,
  `systemRole` enum('SUPER_ADMIN','ADMIN','MEMBER') NOT NULL DEFAULT 'MEMBER',
  `username` varchar(191) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `VerificationToken`
--

CREATE TABLE `VerificationToken` (
  `identifier` varchar(191) NOT NULL,
  `token` varchar(191) NOT NULL,
  `expires` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `VerificationToken`
--

INSERT INTO `VerificationToken` (`identifier`, `token`, `expires`) VALUES
('thefunbadger@gmail.com', '0df1f617a135535ca2327e9d1301ee8e4d80a2bb22083caddc9edef71eb68cbe', '2026-07-25 19:27:39.896'),
('thefunbadger@gmail.com', '3b98c2814b6af16cfaf8051fd756b5755b4bac07fdfecc30ca61c7ed632a8ea2', '2026-07-25 19:20:08.681'),
('thefunbadger@gmail.com', '4de77b5e2451d393f26a9659f5b18eb4466a14e38dadfec1f4af1fdbf47b7f07', '2026-07-25 19:27:55.557'),
('thefunbadger@gmail.com', '4f2fb4594a6cd22e6fd02e8f0790ed9c20e2f7c15795a7ad9800ecf9591e321c', '2026-07-25 22:31:53.291'),
('thefunbadger@gmail.com', '5797e43c20a07cea25901de567008b983e95c2ba9587f311d4139560e9b2bd41', '2026-07-25 19:51:49.057'),
('thefunbadger@gmail.com', '9810915f646354a7e416a42ee2db0c8f7e7bed3280c24eaf3051f017ac54b76d', '2026-07-25 19:18:23.766'),
('thefunbadger@gmail.com', 'c72159e13058c197841a6a3d0ffbc6417808fe46ed415274d4318b5263b51009', '2026-07-25 22:57:45.808'),
('thefunbadger@gmail.com', 'd741531d06f2f59432ec93d4fc41f2922b43906a7e6934d21290e67cff1a3f9f', '2026-07-25 19:24:56.802'),
('thefunbadger21@gmail.com', 'f8e168bcacfdadff519770641ed391a6e79da247e92aa37d0519f4bb239ca741', '2026-07-25 19:58:26.721');

-- --------------------------------------------------------

--
-- Table structure for table `WebhookEvent`
--

CREATE TABLE `WebhookEvent` (
  `id` varchar(191) NOT NULL,
  `workspaceId` varchar(191) DEFAULT NULL,
  `object` varchar(191) DEFAULT NULL,
  `payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`payload`)),
  `status` enum('PENDING','PROCESSED','FAILED') NOT NULL DEFAULT 'PENDING',
  `errorMessage` text DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `processedAt` datetime(3) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `WebhookEvent`
--

INSERT INTO `WebhookEvent` (`id`, `workspaceId`, `object`, `payload`, `status`, `errorMessage`, `createdAt`, `processedAt`) VALUES
('cms1vs6gx0000swnpn030rcs9', NULL, 'instagram', '{\"entry\":[{\"id\":\"0\",\"time\":1785075363,\"changes\":[{\"field\":\"comments\",\"value\":{\"from\":{\"id\":\"232323232\",\"username\":\"test\"},\"media\":{\"id\":\"123123123\",\"media_product_type\":\"FEED\"},\"id\":\"17865799348089039\",\"parent_id\":\"1231231234\",\"text\":\"This is an example.\"}}]}],\"object\":\"instagram\"}', 'PROCESSED', NULL, '2026-07-26 14:16:04.546', '2026-07-26 14:16:04.564'),
('cms1wsr3w0006swo83u9udee4', NULL, 'instagram', '{\"entry\":[{\"id\":\"17841401025517140\",\"time\":1785077069,\"changes\":[{\"value\":{\"from\":{\"id\":\"26216811814633132\",\"username\":\"armin.reel\"},\"media\":{\"id\":\"17924684643158874\",\"media_product_type\":\"REELS\"},\"id\":\"18111561478962603\",\"text\":\"سلام\"},\"field\":\"comments\"}]}],\"object\":\"instagram\"}', 'PROCESSED', NULL, '2026-07-26 14:44:30.909', '2026-07-26 14:44:30.920'),
('cms1wvc5e0008swo8i3yofuo3', NULL, 'instagram', '{\"entry\":[{\"id\":\"17841401025517140\",\"time\":1785077188,\"changes\":[{\"value\":{\"from\":{\"id\":\"26216811814633132\",\"username\":\"armin.reel\"},\"media\":{\"id\":\"17924684643158874\",\"media_product_type\":\"REELS\"},\"id\":\"18146458084544289\",\"text\":\"سلام\"},\"field\":\"comments\"}]}],\"object\":\"instagram\"}', 'PROCESSED', NULL, '2026-07-26 14:46:31.490', '2026-07-26 14:46:32.476'),
('cms1ww1pw000aswo8w7c1wn6w', NULL, 'instagram', '{\"entry\":[{\"id\":\"17841401025517140\",\"time\":1785077223,\"changes\":[{\"value\":{\"from\":{\"id\":\"26216811814633132\",\"username\":\"armin.reel\"},\"media\":{\"id\":\"17924684643158874\",\"media_product_type\":\"REELS\"},\"id\":\"17894721114379146\",\"text\":\"سلام\"},\"field\":\"comments\"}]}],\"object\":\"instagram\"}', 'PROCESSED', NULL, '2026-07-26 14:47:04.628', '2026-07-26 14:47:04.637'),
('cms1ww4f4000eswo8x6oqrc73', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785077226510,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"17841401025517140\"},\"recipient\":{\"id\":\"26216811814633132\"},\"timestamp\":1785077225996,\"message\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTcxNDYxMjg5MTE5MjExNzozMjkyODg2MjczOTc2MDA0NDYxNzQyMDAyMzAxMTQ3NTQ1NgZDZD\",\"attachments\":[{\"type\":\"template\",\"payload\":{\"generic\":{\"elements\":[{\"title\":\"چطوری\",\"buttons\":[{\"type\":\"open_url\",\"url\":\"https://insta.digitalelite.ir/r/_D5Er9Ty5Q\",\"title\":\"Open link\"}]}]}}}],\"is_echo\":true}}]}]}', 'PROCESSED', NULL, '2026-07-26 14:47:08.128', '2026-07-26 14:47:08.130'),
('cms1ww54f000fswo89ltpkahf', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785077227724,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"26216811814633132\"},\"recipient\":{\"id\":\"17841401025517140\"},\"timestamp\":1785077227702,\"message_edit\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTcxNDYxMjg5MTE5MjExNzozMjkyODg2MjczOTc2MDA0NDYxNzQyMDAyMzAxMTQ3NTQ1NgZDZD\",\"num_edit\":0}}]}]}', 'PROCESSED', NULL, '2026-07-26 14:47:09.039', '2026-07-26 14:47:09.041'),
('cms1wwb2r000gswo83ycewufs', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785077236303,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"26216811814633132\"},\"recipient\":{\"id\":\"17841401025517140\"},\"timestamp\":1785077235736,\"read\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTcxNDYxMjg5MTE5MjExNzozMjkyODg2MjczOTc2MDA0NDYxNzQyMDAyMzAxMTQ3NTQ1NgZDZD\"}}]}]}', 'PROCESSED', NULL, '2026-07-26 14:47:16.755', '2026-07-26 14:47:16.757'),
('cms1wy2p8000jswo8g7wazm8b', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785077318503,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"17841401025517140\"},\"recipient\":{\"id\":\"26216811814633132\"},\"timestamp\":1785077318209,\"message\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTcxNDYxMjg5MTE5MjExNzozMjkyODg2NDQ0MDgwMzMwNjQ3NzAxMzQ1MTI0NTg3OTI5NgZDZD\",\"attachments\":[{\"type\":\"template\",\"payload\":{\"generic\":{\"elements\":[{\"title\":\"چطوری\",\"buttons\":[{\"type\":\"open_url\",\"url\":\"https://insta.digitalelite.ir/r/_D5Er9Ty5Q\",\"title\":\"Open link\"}]}]}}}],\"is_echo\":true}}]}]}', 'PROCESSED', NULL, '2026-07-26 14:48:39.213', '2026-07-26 14:48:39.255'),
('cms1wy3fl000kswo88hv0p5mr', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785077319129,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"26216811814633132\"},\"recipient\":{\"id\":\"17841401025517140\"},\"timestamp\":1785077319093,\"message_edit\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTcxNDYxMjg5MTE5MjExNzozMjkyODg2NDQ0MDgwMzMwNjQ3NzAxMzQ1MTI0NTg3OTI5NgZDZD\",\"num_edit\":0}}]}]}', 'PROCESSED', NULL, '2026-07-26 14:48:40.162', '2026-07-26 14:48:40.476'),
('cms1wy4mr000lswo869qt6hhh', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785077320333,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"17841401025517140\"},\"recipient\":{\"id\":\"26216811814633132\"},\"timestamp\":1785077318293,\"message\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTcxNDYxMjg5MTE5MjExNzozMjkyODg2NDQ0MjM1MzA5MTIzMzYyMjA4NTUxNTM0NTkyMAZDZD\",\"attachments\":[{\"type\":\"template\",\"payload\":{\"generic\":{\"elements\":[{\"title\":\"چطوری\",\"buttons\":[{\"type\":\"open_url\",\"url\":\"https://insta.digitalelite.ir/r/_D5Er9Ty5Q\",\"title\":\"Open link\"}]}]}}}],\"is_echo\":true}}]}]}', 'PROCESSED', NULL, '2026-07-26 14:48:41.712', '2026-07-26 14:48:41.755'),
('cms1wy4nd000mswo8wosxo3bz', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785077320779,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"26216811814633132\"},\"recipient\":{\"id\":\"17841401025517140\"},\"timestamp\":1785077320738,\"message_edit\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTcxNDYxMjg5MTE5MjExNzozMjkyODg2NDQ0MjM1MzA5MTIzMzYyMjA4NTUxNTM0NTkyMAZDZD\",\"num_edit\":0}}]}]}', 'PROCESSED', NULL, '2026-07-26 14:48:41.720', '2026-07-26 14:48:41.772'),
('cms1wzstc000nswo80mi32k1f', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785077398863,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"26216811814633132\"},\"recipient\":{\"id\":\"17841401025517140\"},\"timestamp\":1785077398350,\"read\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTcxNDYxMjg5MTE5MjExNzozMjkyODg2NDQ0MjM1MzA5MTIzMzYyMjA4NTUxNTM0NTkyMAZDZD\"}}]}]}', 'PROCESSED', NULL, '2026-07-26 14:49:59.712', '2026-07-26 14:49:59.714'),
('cms1x08no000oswo8dadw0gcy', NULL, 'instagram', '{\"entry\":[{\"id\":\"17841401025517140\",\"time\":1785077419,\"changes\":[{\"value\":{\"from\":{\"id\":\"26216811814633132\",\"username\":\"armin.reel\"},\"media\":{\"id\":\"17924684643158874\",\"media_product_type\":\"REELS\"},\"id\":\"17978089953117706\",\"text\":\"op\"},\"field\":\"comments\"}]}],\"object\":\"instagram\"}', 'PROCESSED', NULL, '2026-07-26 14:50:20.244', '2026-07-26 14:50:20.254'),
('cms1x0a1x000sswo8paq7rc86', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785077421369,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"17841401025517140\"},\"recipient\":{\"id\":\"26216811814633132\"},\"timestamp\":1785077421094,\"message\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTcxNDYxMjg5MTE5MjExNzozMjkyODg2NjMzODY4NTc2MDcwODU5MzQ3NTQ2MDc5MjMyMAZDZD\",\"attachments\":[{\"type\":\"template\",\"payload\":{\"generic\":{\"elements\":[{\"title\":\"چطوری {op}\",\"buttons\":[{\"type\":\"open_url\",\"url\":\"https://insta.digitalelite.ir/r/_D5Er9Ty5Q\",\"title\":\"Open link\"}]}]}}}],\"is_echo\":true}}]}]}', 'PROCESSED', NULL, '2026-07-26 14:50:22.053', '2026-07-26 14:50:22.082'),
('cms1x0a6y000tswo8sywyfl08', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785077421849,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"26216811814633132\"},\"recipient\":{\"id\":\"17841401025517140\"},\"timestamp\":1785077421831,\"message_edit\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTcxNDYxMjg5MTE5MjExNzozMjkyODg2NjMzODY4NTc2MDcwODU5MzQ3NTQ2MDc5MjMyMAZDZD\",\"num_edit\":0}}]}]}', 'PROCESSED', NULL, '2026-07-26 14:50:22.235', '2026-07-26 14:50:22.236'),
('cms1x0dlz000uswo8hc8efo7w', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785077426325,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"26216811814633132\"},\"recipient\":{\"id\":\"17841401025517140\"},\"timestamp\":1785077425829,\"read\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTcxNDYxMjg5MTE5MjExNzozMjkyODg2NjMzODY4NTc2MDcwODU5MzQ3NTQ2MDc5MjMyMAZDZD\"}}]}]}', 'PROCESSED', NULL, '2026-07-26 14:50:26.664', '2026-07-26 14:50:26.667'),
('cms1x1uh2000vswo8ioztpsmt', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785077493909,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"26216811814633132\"},\"recipient\":{\"id\":\"17841401025517140\"},\"timestamp\":1785077493385,\"message\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTcxNDYxMjg5MTE5MjExNzozMjkyODg2NzY3MjIyNDIyNDkyODMxMDIwNDM2NDIyNjU2MAZDZD\",\"text\":\"عالی\"}}]}]}', 'PROCESSED', NULL, '2026-07-26 14:51:35.175', '2026-07-26 14:51:35.305'),
('cms1x1vs5000wswo8uhmzjjny', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785077494689,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"26216811814633132\"},\"recipient\":{\"id\":\"17841401025517140\"},\"timestamp\":1785077494655,\"message_edit\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTcxNDYxMjg5MTE5MjExNzozMjkyODg2NzY3MjIyNDIyNDkyODMxMDIwNDM2NDIyNjU2MAZDZD\",\"num_edit\":0}}]}]}', 'PROCESSED', NULL, '2026-07-26 14:51:36.869', '2026-07-26 14:51:37.327'),
('cms1x3ptm000xswo8z643yfrs', NULL, 'instagram', '{\"entry\":[{\"id\":\"17841401025517140\",\"time\":1785077580,\"changes\":[{\"value\":{\"from\":{\"id\":\"26216811814633132\",\"username\":\"armin.reel\"},\"media\":{\"id\":\"17924684643158874\",\"media_product_type\":\"REELS\"},\"id\":\"17974324341072719\",\"text\":\"عالی\"},\"field\":\"comments\"}]}],\"object\":\"instagram\"}', 'PROCESSED', NULL, '2026-07-26 14:53:02.458', '2026-07-26 14:53:02.477'),
('cms1x4lin000zswo8btedza0z', NULL, 'instagram', '{\"entry\":[{\"id\":\"17841401025517140\",\"time\":1785077622,\"changes\":[{\"value\":{\"from\":{\"id\":\"26216811814633132\",\"username\":\"armin.reel\"},\"media\":{\"id\":\"17924684643158874\",\"media_product_type\":\"REELS\"},\"id\":\"17891575071397732\",\"text\":\"عالی\"},\"field\":\"comments\"}]}],\"object\":\"instagram\"}', 'PROCESSED', NULL, '2026-07-26 14:53:43.535', '2026-07-26 14:53:49.760'),
('cms1x4xdo0011swo8zhxee7v5', NULL, 'instagram', '{\"entry\":[{\"id\":\"17841401025517140\",\"time\":1785077637,\"changes\":[{\"value\":{\"from\":{\"id\":\"26216811814633132\",\"username\":\"armin.reel\"},\"media\":{\"id\":\"17924684643158874\",\"media_product_type\":\"REELS\"},\"id\":\"17937878601293199\",\"text\":\"ts\"},\"field\":\"comments\"}]}],\"object\":\"instagram\"}', 'PROCESSED', NULL, '2026-07-26 14:53:58.908', '2026-07-26 14:53:58.917'),
('cms1x4yp80015swo874glriyo', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785077640324,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"26216811814633132\"},\"recipient\":{\"id\":\"17841401025517140\"},\"timestamp\":1785077640296,\"message_edit\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTcxNDYxMjg5MTE5MjExNzozMjkyODg3MDM2ODc1MTAxMTM0NjUzOTQ4NzEzNTAwNjcyMAZDZD\",\"num_edit\":0}}]}]}', 'PROCESSED', NULL, '2026-07-26 14:54:00.620', '2026-07-26 14:54:00.622'),
('cms1x4yqj0016swo86n1s5l8w', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785077640043,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"17841401025517140\"},\"recipient\":{\"id\":\"26216811814633132\"},\"timestamp\":1785077639564,\"message\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTcxNDYxMjg5MTE5MjExNzozMjkyODg3MDM2ODc1MTAxMTM0NjUzOTQ4NzEzNTAwNjcyMAZDZD\",\"attachments\":[{\"type\":\"template\",\"payload\":{\"generic\":{\"elements\":[{\"title\":\"چطوری {op}\",\"buttons\":[{\"type\":\"open_url\",\"url\":\"https://insta.digitalelite.ir/r/_D5Er9Ty5Q\",\"title\":\"Open link\"}]}]}}}],\"is_echo\":true}}]}]}', 'PROCESSED', NULL, '2026-07-26 14:54:00.667', '2026-07-26 14:54:00.669'),
('cms1x4yx20017swo881swofll', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785077640458,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"26216811814633132\"},\"recipient\":{\"id\":\"17841401025517140\"},\"timestamp\":1785077640000,\"read\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTcxNDYxMjg5MTE5MjExNzozMjkyODg3MDM2ODc1MTAxMTM0NjUzOTQ4NzEzNTAwNjcyMAZDZD\"}}]}]}', 'PROCESSED', NULL, '2026-07-26 14:54:00.903', '2026-07-26 14:54:00.908'),
('cms1xba5j0000swo0dq66iyhv', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785077935102,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"26216811814633132\"},\"recipient\":{\"id\":\"17841401025517140\"},\"timestamp\":1785077894141,\"read\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTcxNDYxMjg5MTE5MjExNzozMjkyODg3MDM2ODc1MTAxMTM0NjUzOTQ4NzEzNTAwNjcyMAZDZD\"}}]}]}', 'PROCESSED', NULL, '2026-07-26 14:58:55.399', '2026-07-26 14:58:55.403'),
('cms1xbpe80001swo0rp6v7a8h', NULL, 'instagram', '{\"entry\":[{\"id\":\"17841401025517140\",\"time\":1785077953,\"changes\":[{\"value\":{\"from\":{\"id\":\"26216811814633132\",\"username\":\"armin.reel\"},\"media\":{\"id\":\"17924684643158874\",\"media_product_type\":\"REELS\"},\"id\":\"17965901166128631\",\"text\":\"عالی\"},\"field\":\"comments\"}]}],\"object\":\"instagram\"}', 'PROCESSED', NULL, '2026-07-26 14:59:15.153', '2026-07-26 14:59:15.168'),
('cms1xc3rh0003swo00qgm3j9l', NULL, 'instagram', '{\"entry\":[{\"id\":\"17841401025517140\",\"time\":1785077972,\"changes\":[{\"value\":{\"from\":{\"id\":\"26216811814633132\",\"username\":\"armin.reel\"},\"media\":{\"id\":\"17924684643158874\",\"media_product_type\":\"REELS\"},\"id\":\"18091426895633000\",\"text\":\"op\"},\"field\":\"comments\"}]}],\"object\":\"instagram\"}', 'PROCESSED', NULL, '2026-07-26 14:59:33.773', '2026-07-26 14:59:36.466'),
('cms1y9kp80005swo0s9ynhr8e', NULL, 'instagram', '{\"entry\":[{\"id\":\"17841401025517140\",\"time\":1785079534,\"changes\":[{\"value\":{\"from\":{\"id\":\"7362932433784009\",\"username\":\"ghazal._.8022\"},\"media\":{\"id\":\"17924684643158874\",\"media_product_type\":\"REELS\"},\"id\":\"18076897052700994\",\"text\":\"gombol\"},\"field\":\"comments\"}]}],\"object\":\"instagram\"}', 'PROCESSED', NULL, '2026-07-26 15:25:35.372', '2026-07-26 15:25:35.382'),
('cms1y9qol0009swo08rmu4ryn', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785079541656,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"17841401025517140\"},\"recipient\":{\"id\":\"7362932433784009\"},\"timestamp\":1785079541158,\"message\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTYxNjI5OTk1NDM1Njc0NTozMjkyODkwNTQ0Njk3MDgxNjgwMzA1MjM5NjAyMzM4MjAxNgZDZD\",\"attachments\":[{\"type\":\"template\",\"payload\":{\"generic\":{\"elements\":[{\"title\":\"سیلام\",\"buttons\":[{\"type\":\"open_url\",\"url\":\"https://insta.digitalelite.ir/r/_D5Er9Ty5Q\",\"title\":\"Open link\"}]}]}}}],\"is_echo\":true}}]}]}', 'PROCESSED', NULL, '2026-07-26 15:25:43.126', '2026-07-26 15:25:43.127'),
('cms1ya104000aswo0fnb861bp', NULL, 'instagram', '{\"entry\":[{\"id\":\"17841401025517140\",\"time\":1785079555,\"changes\":[{\"value\":{\"from\":{\"id\":\"7362932433784009\",\"username\":\"ghazal._.8022\"},\"media\":{\"id\":\"17924684643158874\",\"media_product_type\":\"REELS\"},\"id\":\"18090723791635196\",\"text\":\"gombol\"},\"field\":\"comments\"}]}],\"object\":\"instagram\"}', 'PROCESSED', NULL, '2026-07-26 15:25:56.500', '2026-07-26 15:25:56.520'),
('cms1ya2n8000cswo0nrkgqeaj', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785079558039,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"17841401025517140\"},\"recipient\":{\"id\":\"7362932433784009\"},\"timestamp\":1785079557640,\"message\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTYxNjI5OTk1NDM1Njc0NTozMjkyODkwNTc1MTAwODY1MDY3MzM4MzYyMzgzMjM3MTIwMAZDZD\",\"attachments\":[{\"type\":\"template\",\"payload\":{\"generic\":{\"elements\":[{\"title\":\"سیلام\",\"buttons\":[{\"type\":\"open_url\",\"url\":\"https://insta.digitalelite.ir/r/_D5Er9Ty5Q\",\"title\":\"Open link\"}]}]}}}],\"is_echo\":true}}]}]}', 'PROCESSED', NULL, '2026-07-26 15:25:58.629', '2026-07-26 15:25:58.713'),
('cms1yktn4000dswo0naijucwp', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785080059185,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"24791699150443726\"},\"recipient\":{\"id\":\"17841401025517140\"},\"timestamp\":1785080058292,\"message\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1ODY5NTQxNzg0OTc3NTg0MTozMjkyODkxNDk4NjQwNjA2NDY0OTU3ODQ2NzQwMjE4Njc1MgZDZD\",\"attachments\":[{\"type\":\"ig_reel\",\"payload\":{\"reel_video_id\":\"18112112942492524\",\"title\":\"عزیزِ دلِ خواهر🤍✨\\n.\\n@mahzin.artgallery \\nاگه به کالیگرافی علاقه داری با من همراه شو🌱\\n@mahzin.artgallery \\n.\\n.\\n.\\n.\\n.\\n#برادر #کالیگرافی #calligraphy #نقاشیخط #خطاطی\",\"url\":\"https://www.instagram.com/reel/DaiJflcto89/\"}}]}}]}]}', 'PROCESSED', NULL, '2026-07-26 15:34:20.176', '2026-07-26 15:34:20.186'),
('cms1znx9d0000swrmtuw3uwe6', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785081882875,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"7362932433784009\"},\"recipient\":{\"id\":\"17841401025517140\"},\"timestamp\":1785081882037,\"read\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTYxNjI5OTk1NDM1Njc0NTozMjkyODkwNTc1MTAwODY1MDY3MzM4MzYyMzgzMjM3MTIwMAZDZD\"}}]}]}', 'PROCESSED', NULL, '2026-07-26 16:04:44.449', '2026-07-26 16:04:44.454'),
('cms1znyn20001swrm092j3ay2', NULL, 'instagram', '{\"entry\":[{\"id\":\"17841401025517140\",\"time\":1785081884,\"changes\":[{\"value\":{\"from\":{\"id\":\"7362932433784009\",\"username\":\"ghazal._.8022\"},\"media\":{\"id\":\"17924684643158874\",\"media_product_type\":\"REELS\"},\"id\":\"18063851687719643\",\"text\":\"gombol\"},\"field\":\"comments\"}]}],\"object\":\"instagram\"}', 'PROCESSED', NULL, '2026-07-26 16:04:46.238', '2026-07-26 16:04:46.281'),
('cms1zo0t10005swrm6dgftara', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785081887964,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"17841401025517140\"},\"recipient\":{\"id\":\"7362932433784009\"},\"timestamp\":1785081887583,\"message\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTYxNjI5OTk1NDM1Njc0NTozMjkyODk0ODczMDg3NjMxOTc5MzkzOTE4ODk4Nzk4NTkyMAZDZD\",\"attachments\":[{\"type\":\"template\",\"payload\":{\"generic\":{\"elements\":[{\"title\":\"سیلام\",\"buttons\":[{\"type\":\"open_url\",\"url\":\"https://insta.digitalelite.ir/r/_D5Er9Ty5Q\",\"title\":\"Open link\"}]}]}}}],\"is_echo\":true}}]}]}', 'PROCESSED', NULL, '2026-07-26 16:04:49.045', '2026-07-26 16:04:49.048'),
('cms1zo3r20006swrm5z9qdpgi', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785081891730,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"7362932433784009\"},\"recipient\":{\"id\":\"17841401025517140\"},\"timestamp\":1785081891196,\"message\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTYxNjI5OTk1NDM1Njc0NTozMjkyODk0ODc5NzUyMzA0MTA3MzE5MDM0NDQ2OTc3NDMzNgZDZD\",\"text\":\"😂😂😂\"}}]}]}', 'PROCESSED', NULL, '2026-07-26 16:04:52.863', '2026-07-26 16:04:52.889'),
('cms1zoove0007swrmajm7q3i4', NULL, 'instagram', '{\"entry\":[{\"id\":\"17841401025517140\",\"time\":1785081919,\"changes\":[{\"value\":{\"from\":{\"id\":\"7362932433784009\",\"username\":\"ghazal._.8022\"},\"media\":{\"id\":\"17924684643158874\",\"media_product_type\":\"REELS\"},\"id\":\"18050477894606114\",\"text\":\"gombol\"},\"field\":\"comments\"}]}],\"object\":\"instagram\"}', 'PROCESSED', NULL, '2026-07-26 16:05:20.234', '2026-07-26 16:05:20.251'),
('cms1zoqwx000bswrmm8r6ra8t', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785081922187,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"17841401025517140\"},\"recipient\":{\"id\":\"7362932433784009\"},\"timestamp\":1785081921831,\"message\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTYxNjI5OTk1NDM1Njc0NTozMjkyODk0OTM2MjYzNjgxMzcxNTI0OTUzOTM3MDE4ODgwMAZDZD\",\"attachments\":[{\"type\":\"template\",\"payload\":{\"generic\":{\"elements\":[{\"title\":\"سیلام\",\"buttons\":[{\"type\":\"open_url\",\"url\":\"https://insta.digitalelite.ir/r/_D5Er9Ty5Q\",\"title\":\"Open link\"}]}]}}}],\"is_echo\":true}}]}]}', 'PROCESSED', NULL, '2026-07-26 16:05:22.882', '2026-07-26 16:05:22.883'),
('cms1zos26000cswrm0i9pzynq', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785081923237,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"7362932433784009\"},\"recipient\":{\"id\":\"17841401025517140\"},\"timestamp\":1785081922332,\"read\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTYxNjI5OTk1NDM1Njc0NTozMjkyODk0OTM2MjYzNjgxMzcxNTI0OTUzOTM3MDE4ODgwMAZDZD\"}}]}]}', 'PROCESSED', NULL, '2026-07-26 16:05:24.367', '2026-07-26 16:05:24.368'),
('cms1zotap000dswrmpo7fg7ao', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785081925332,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"7362932433784009\"},\"recipient\":{\"id\":\"17841401025517140\"},\"timestamp\":1785081922703,\"read\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTYxNjI5OTk1NDM1Njc0NTozMjkyODk0OTM2MjYzNjgxMzcxNTI0OTUzOTM3MDE4ODgwMAZDZD\"}}]}]}', 'PROCESSED', NULL, '2026-07-26 16:05:25.969', '2026-07-26 16:05:25.971'),
('cms1zovrb000gswrmtk04psem', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785081928397,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"7362932433784009\"},\"recipient\":{\"id\":\"17841401025517140\"},\"timestamp\":1785081927815,\"message\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTYxNjI5OTk1NDM1Njc0NTozMjkyODk0OTQ3MzAwODkwMzkzNjgyNjY0NjQ5MTgyNDEyOAZDZD\",\"text\":\"سیلام به توووو\"}}]}]}', 'PROCESSED', NULL, '2026-07-26 16:05:29.159', '2026-07-26 16:05:29.162'),
('cms29c1mm000jswrmqykdq8wo', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785098125598,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"7362932433784009\"},\"recipient\":{\"id\":\"17841401025517140\"},\"timestamp\":1785098125056,\"message\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTYxNjI5OTk1NDM1Njc0NTozMjkyOTI0ODI1OTM3ODY3OTc1NTYyMzUyMzg0MTczNjcwNAZDZD\",\"attachments\":[{\"type\":\"ig_reel\",\"payload\":{\"reel_video_id\":\"18089615360121768\",\"title\":\"Приколы про Равашку продолжаются 🤣\",\"url\":\"https://www.instagram.com/reel/DbLA7FTo4Zi/\"}}]}}]}]}', 'PROCESSED', NULL, '2026-07-26 20:35:26.399', '2026-07-26 20:35:28.855'),
('cms29o1wq000kswrmsh3vz82t', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785098686763,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"7362932433784009\"},\"recipient\":{\"id\":\"17841401025517140\"},\"timestamp\":1785098685368,\"message\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTYxNjI5OTk1NDM1Njc0NTozMjkyOTI1ODU5NTMxNDcyOTY4MDY4OTczMDE2OTA3Nzc2MAZDZD\",\"attachments\":[{\"type\":\"ig_reel\",\"payload\":{\"reel_video_id\":\"18114727240877158\",\"title\":\"Any guesses on what Evie wants to eat??🤣🤣🤣\",\"url\":\"https://www.instagram.com/reel/DYx6NcKCmbP/\"}}]}}]}]}', 'PROCESSED', NULL, '2026-07-26 20:44:46.634', '2026-07-26 20:44:46.638'),
('cms2a1sxf000lswrmevvcsuo6', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785099326922,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"7362932433784009\"},\"recipient\":{\"id\":\"17841401025517140\"},\"timestamp\":1785099326491,\"message\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTYxNjI5OTk1NDM1Njc0NTozMjkyOTI3MDQyMTkzNjI4MTgyNjE1MzIzOTgxNTM4OTE4NAZDZD\",\"attachments\":[{\"type\":\"ig_reel\",\"payload\":{\"reel_video_id\":\"18101451992591564\",\"title\":\"V stepped into the crowd, taking in live performances at Vogue World: Hollywood.\\nKnown for his own standout fashion moments, he kept it effortlessly stylish in a look worthy of the runway. #taehyung\",\"url\":\"https://www.instagram.com/reel/DbAZ169Rqk2/\"}}]}}]}]}', 'PROCESSED', NULL, '2026-07-26 20:55:28.179', '2026-07-26 20:55:28.182'),
('cms2a40tk000mswrmu61cyvwo', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785099431184,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"7362932433784009\"},\"recipient\":{\"id\":\"17841401025517140\"},\"timestamp\":1785099430711,\"message\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTYxNjI5OTk1NDM1Njc0NTozMjkyOTI3MjM0NDQ1OTYwMTY0MzQ4OTMwMzcyNjEyOTE1MgZDZD\",\"attachments\":[{\"type\":\"ig_reel\",\"payload\":{\"reel_video_id\":\"18361344274244919\",\"title\":\"今夜、@thvはハリウッドで行われた @gracieabrams と @dojacat のパフォーマンスを観客席から鑑賞しました。\\n\\nファッションショーにも慣れている @bts.bighitofficial のスターは、ランウェイに登場してもおかしくないような装いで登場しました。\\n#onepiece #loki #mindcatalyst_snr #bhaichara\",\"url\":\"https://www.instagram.com/reel/DalX0j5Aps6/\"}}]}}]}]}', 'PROCESSED', NULL, '2026-07-26 20:57:11.721', '2026-07-26 20:57:11.737'),
('cms2a6i5t000nswrmdh2frsqf', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785099546734,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"7362932433784009\"},\"recipient\":{\"id\":\"17841401025517140\"},\"timestamp\":1785099546230,\"message\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTYxNjI5OTk1NDM1Njc0NTozMjkyOTI3NDQ3NTQwMDc4NDU5OTc0MjA0ODY4NTI2MDgwMAZDZD\",\"attachments\":[{\"type\":\"ig_reel\",\"payload\":{\"reel_video_id\":\"18071097422393006\",\"title\":\"今夜、@thv はハリウッドで行われた @gracieabrams と @dojacat のパフォーマンスを観客席から鑑賞しました。ファッションショーにも慣れている @bts.bighitofficial のスターは、ランウェイに登場してもおかしくないような装いで登場しました。\",\"url\":\"https://www.instagram.com/reel/Da5k32hBFQK/\"}}]}}]}]}', 'PROCESSED', NULL, '2026-07-26 20:59:07.505', '2026-07-26 20:59:07.508'),
('cms2a7gho000oswrmsb87tx84', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785099591675,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"7362932433784009\"},\"recipient\":{\"id\":\"17841401025517140\"},\"timestamp\":1785099591223,\"message\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTYxNjI5OTk1NDM1Njc0NTozMjkyOTI3NTMwNTM3NTE3NzYwMTY0NDA1MTk2MzA1MjAzMgZDZD\",\"attachments\":[{\"type\":\"ig_reel\",\"payload\":{\"reel_video_id\":\"18195950872373425\",\"title\":\"نزدیک دستگاه من نشین! 😂\",\"url\":\"https://www.instagram.com/reel/DbQEYIbIsxz/\"}}]}}]}]}', 'PROCESSED', NULL, '2026-07-26 20:59:51.996', '2026-07-26 20:59:51.998'),
('cms31cggp0000swya41f9n87z', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785145173802,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"7374363289312520\"},\"recipient\":{\"id\":\"17841401025517140\"},\"timestamp\":1785145172589,\"message\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTYyMDU1ODg5NzI2NDE4NDozMjkzMDExNjEzMzE4MzA2NzA4Mjk1MjkyNDM5MTgwMDgzMgZDZD\",\"attachments\":[{\"type\":\"ig_reel\",\"payload\":{\"reel_video_id\":\"18438243148193961\",\"title\":\"⁨\\t⁨\\t⁨\\t#اکسپلور #ریلز #ترند #ایران #وایرال \\n\\nمتاسفانه امروز باز همه چیز گرون شد عاجزانه از مسئولین محترم تقاضا داریم جلو این کارخونه دار ها رو بگیرن اینا فرصت طلب شدن منتظر یک اتفاق هستن تا جنس هاشون رو گرون کنن ، بخدا قسم حرف دلم رو میزنم ما همه جوره پای این آب و خاک‌وایسادیم و پشتتون هستیم یکمم حواستون به ما مردم باشه ما داریم از داخل ضربه میخوریم لطفا جلشون رو بگیرید \\nسپاس فراوان🙏🏼🙏🏼🙏🏼\\n\\nپاینده باد ایران 🇮🇷🇮🇷🇮🇷🇮🇷🇮🇷⁩⁩⁩\",\"url\":\"https://www.instagram.com/reel/DbQcgz8tQQH/\"}}]}}]}]}', 'PROCESSED', NULL, '2026-07-27 09:39:34.874', '2026-07-27 09:39:37.520'),
('cms33vqzm0004swf6ezl2qikx', NULL, 'instagram', '{\"entry\":[{\"id\":\"17841401025517140\",\"time\":1785149432,\"changes\":[{\"value\":{\"from\":{\"id\":\"26216811814633132\",\"username\":\"armin.reel\"},\"media\":{\"id\":\"17924684643158874\",\"media_product_type\":\"REELS\"},\"id\":\"17975862404900413\",\"text\":\"سلام\"},\"field\":\"comments\"}]}],\"object\":\"instagram\"}', 'PROCESSED', NULL, '2026-07-27 10:50:34.211', '2026-07-27 10:50:34.628'),
('cms33yc3x0006swf6x0il08xj', NULL, 'instagram', '{\"entry\":[{\"id\":\"17841401025517140\",\"time\":1785149553,\"changes\":[{\"value\":{\"from\":{\"id\":\"26216811814633132\",\"username\":\"armin.reel\"},\"media\":{\"id\":\"17924684643158874\",\"media_product_type\":\"REELS\"},\"id\":\"17954580360193126\",\"text\":\"op\"},\"field\":\"comments\"}]}],\"object\":\"instagram\"}', 'PROCESSED', NULL, '2026-07-27 10:52:34.894', '2026-07-27 10:52:35.432'),
('cms33yrrt000cswf6bt04k93m', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785149574185,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"17841401025517140\"},\"recipient\":{\"id\":\"26216811814633132\"},\"timestamp\":1785149573808,\"message\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTcxNDYxMjg5MTE5MjExNzozMjkzMDE5NzMyMTM0MzgzMDY4NTI0OTAxMDE0NTQyNzQ1NgZDZD\",\"text\":\"hello\",\"is_echo\":true}}]}]}', 'PROCESSED', NULL, '2026-07-27 10:52:55.194', '2026-07-27 10:52:55.203'),
('cms33yt40000dswf6ovp82rto', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785149575624,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"26216811814633132\"},\"recipient\":{\"id\":\"17841401025517140\"},\"timestamp\":1785149575608,\"message_edit\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTcxNDYxMjg5MTE5MjExNzozMjkzMDE5NzMyMTM0MzgzMDY4NTI0OTAxMDE0NTQyNzQ1NgZDZD\",\"num_edit\":0}}]}]}', 'PROCESSED', NULL, '2026-07-27 10:52:56.928', '2026-07-27 10:52:56.931'),
('cms34047p000eswf64sbjf5m5', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785149637576,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"26216811814633132\"},\"recipient\":{\"id\":\"17841401025517140\"},\"timestamp\":1785149637106,\"read\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTcxNDYxMjg5MTE5MjExNzozMjkzMDE5NzMyMTM0MzgzMDY4NTI0OTAxMDE0NTQyNzQ1NgZDZD\"}}]}]}', 'PROCESSED', NULL, '2026-07-27 10:53:57.974', '2026-07-27 10:53:57.976'),
('cms34blwh000pswf6g2ewj8x7', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785150173542,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"17841401025517140\"},\"recipient\":{\"id\":\"26216811814633132\"},\"timestamp\":1785150173228,\"message\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTcxNDYxMjg5MTE5MjExNzozMjkzMDIwODM3ODY3NjA1NTQ2NDgzMjA3MTY4NTM3Mzk1MgZDZD\",\"text\":\"hello\",\"is_echo\":true}}]}]}', 'PROCESSED', NULL, '2026-07-27 11:02:54.114', '2026-07-27 11:02:54.116'),
('cms34bmc8000qswf66p7h16a1', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785150174190,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"26216811814633132\"},\"recipient\":{\"id\":\"17841401025517140\"},\"timestamp\":1785150174173,\"message_edit\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTcxNDYxMjg5MTE5MjExNzozMjkzMDIwODM3ODY3NjA1NTQ2NDgzMjA3MTY4NTM3Mzk1MgZDZD\",\"num_edit\":0}}]}]}', 'PROCESSED', NULL, '2026-07-27 11:02:54.680', '2026-07-27 11:02:54.683'),
('cms34plo0000rswf6vu4s09hs', NULL, 'instagram', '{\"object\":\"instagram\",\"entry\":[{\"time\":1785150826421,\"id\":\"17841401025517140\",\"messaging\":[{\"sender\":{\"id\":\"26216811814633132\"},\"recipient\":{\"id\":\"17841401025517140\"},\"timestamp\":1785150825931,\"read\":{\"mid\":\"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDI1NTE3MTQwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTcxNDYxMjg5MTE5MjExNzozMjkzMDIwODM3ODY3NjA1NTQ2NDgzMjA3MTY4NTM3Mzk1MgZDZD\"}}]}]}', 'PROCESSED', NULL, '2026-07-27 11:13:46.992', '2026-07-27 11:13:46.998');

-- --------------------------------------------------------

--
-- Table structure for table `Workspace`
--

CREATE TABLE `Workspace` (
  `id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `ownerId` varchar(191) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  `usagePeriodStart` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `dmsSentThisPeriod` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `WorkspaceInvitation`
--

CREATE TABLE `WorkspaceInvitation` (
  `id` varchar(191) NOT NULL,
  `workspaceId` varchar(191) NOT NULL,
  `email` varchar(191) NOT NULL,
  `role` enum('OWNER','ADMIN','MEMBER') NOT NULL DEFAULT 'MEMBER',
  `token` varchar(191) NOT NULL,
  `status` enum('PENDING','ACCEPTED','REVOKED','EXPIRED') NOT NULL DEFAULT 'PENDING',
  `invitedByUserId` varchar(191) DEFAULT NULL,
  `expiresAt` datetime(3) NOT NULL,
  `acceptedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `WorkspaceMember`
--

CREATE TABLE `WorkspaceMember` (
  `id` varchar(191) NOT NULL,
  `workspaceId` varchar(191) NOT NULL,
  `userId` varchar(191) NOT NULL,
  `role` enum('OWNER','ADMIN','MEMBER') NOT NULL DEFAULT 'OWNER',
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `Account`
--
ALTER TABLE `Account`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `Account_provider_providerAccountId_key` (`provider`,`providerAccountId`),
  ADD KEY `Account_userId_idx` (`userId`);

--
-- Indexes for table `AiAuditLog`
--
ALTER TABLE `AiAuditLog`
  ADD PRIMARY KEY (`id`),
  ADD KEY `AiAuditLog_workspaceId_idx` (`workspaceId`),
  ADD KEY `AiAuditLog_feature_idx` (`feature`),
  ADD KEY `AiAuditLog_createdAt_idx` (`createdAt`);

--
-- Indexes for table `AiConfig`
--
ALTER TABLE `AiConfig`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `AiConfig_workspaceId_key` (`workspaceId`),
  ADD KEY `AiConfig_workspaceId_idx` (`workspaceId`);

--
-- Indexes for table `AiConversationMemory`
--
ALTER TABLE `AiConversationMemory`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `AiConversationMemory_workspaceId_userId_memoryKey_key` (`workspaceId`,`userId`,`memoryKey`),
  ADD KEY `AiConversationMemory_workspaceId_idx` (`workspaceId`),
  ADD KEY `AiConversationMemory_userId_idx` (`userId`);

--
-- Indexes for table `AiGoal`
--
ALTER TABLE `AiGoal`
  ADD PRIMARY KEY (`id`),
  ADD KEY `AiGoal_workspaceId_idx` (`workspaceId`),
  ADD KEY `AiGoal_userId_idx` (`userId`),
  ADD KEY `AiGoal_status_idx` (`status`);

--
-- Indexes for table `Automation`
--
ALTER TABLE `Automation`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `Automation_reportShareSlug_key` (`reportShareSlug`),
  ADD KEY `Automation_workspaceId_idx` (`workspaceId`),
  ADD KEY `Automation_instagramAccountId_idx` (`instagramAccountId`),
  ADD KEY `Automation_postId_idx` (`postId`);

--
-- Indexes for table `BackgroundJob`
--
ALTER TABLE `BackgroundJob`
  ADD PRIMARY KEY (`id`),
  ADD KEY `BackgroundJob_status_runAt_idx` (`status`,`runAt`);

--
-- Indexes for table `ConversationState`
--
ALTER TABLE `ConversationState`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `ConversationState_instagramAccountId_userId_key` (`instagramAccountId`,`userId`),
  ADD KEY `ConversationState_workspaceId_idx` (`workspaceId`),
  ADD KEY `ConversationState_userId_idx` (`userId`),
  ADD KEY `ConversationState_automationId_fkey` (`automationId`);

--
-- Indexes for table `CouponCode`
--
ALTER TABLE `CouponCode`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `CouponCode_poolId_code_key` (`poolId`,`code`),
  ADD KEY `CouponCode_poolId_idx` (`poolId`),
  ADD KEY `CouponCode_claimedByUserId_idx` (`claimedByUserId`);

--
-- Indexes for table `CouponPool`
--
ALTER TABLE `CouponPool`
  ADD PRIMARY KEY (`id`),
  ADD KEY `CouponPool_workspaceId_idx` (`workspaceId`),
  ADD KEY `CouponPool_automationId_idx` (`automationId`);

--
-- Indexes for table `DeadLetterMessage`
--
ALTER TABLE `DeadLetterMessage`
  ADD PRIMARY KEY (`id`),
  ADD KEY `DeadLetterMessage_workspaceId_idx` (`workspaceId`),
  ADD KEY `DeadLetterMessage_status_idx` (`status`),
  ADD KEY `DeadLetterMessage_createdAt_idx` (`createdAt`);

--
-- Indexes for table `DmLog`
--
ALTER TABLE `DmLog`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `DmLog_automationId_commentId_key` (`automationId`,`commentId`),
  ADD KEY `DmLog_workspaceId_idx` (`workspaceId`),
  ADD KEY `DmLog_automationId_idx` (`automationId`),
  ADD KEY `DmLog_instagramAccountId_idx` (`instagramAccountId`),
  ADD KEY `DmLog_status_idx` (`status`);

--
-- Indexes for table `FaqItem`
--
ALTER TABLE `FaqItem`
  ADD PRIMARY KEY (`id`),
  ADD KEY `FaqItem_workspaceId_idx` (`workspaceId`),
  ADD KEY `FaqItem_instagramAccountId_idx` (`instagramAccountId`);

--
-- Indexes for table `FunnelEvent`
--
ALTER TABLE `FunnelEvent`
  ADD PRIMARY KEY (`id`),
  ADD KEY `FunnelEvent_workspaceId_idx` (`workspaceId`),
  ADD KEY `FunnelEvent_automationId_idx` (`automationId`),
  ADD KEY `FunnelEvent_userId_idx` (`userId`),
  ADD KEY `FunnelEvent_stage_idx` (`stage`),
  ADD KEY `FunnelEvent_createdAt_idx` (`createdAt`);

--
-- Indexes for table `Giveaway`
--
ALTER TABLE `Giveaway`
  ADD PRIMARY KEY (`id`),
  ADD KEY `Giveaway_workspaceId_idx` (`workspaceId`),
  ADD KEY `Giveaway_automationId_idx` (`automationId`);

--
-- Indexes for table `GiveawayParticipant`
--
ALTER TABLE `GiveawayParticipant`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `GiveawayParticipant_giveawayId_userId_key` (`giveawayId`,`userId`),
  ADD KEY `GiveawayParticipant_giveawayId_idx` (`giveawayId`),
  ADD KEY `GiveawayParticipant_userId_idx` (`userId`);

--
-- Indexes for table `GiveawayWinner`
--
ALTER TABLE `GiveawayWinner`
  ADD PRIMARY KEY (`id`),
  ADD KEY `GiveawayWinner_giveawayId_idx` (`giveawayId`),
  ADD KEY `GiveawayWinner_participantId_fkey` (`participantId`);

--
-- Indexes for table `InstagramAccount`
--
ALTER TABLE `InstagramAccount`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `InstagramAccount_instagramId_key` (`instagramId`),
  ADD KEY `InstagramAccount_workspaceId_idx` (`workspaceId`);

--
-- Indexes for table `KnowledgeChunk`
--
ALTER TABLE `KnowledgeChunk`
  ADD PRIMARY KEY (`id`),
  ADD KEY `KnowledgeChunk_documentId_idx` (`documentId`);

--
-- Indexes for table `KnowledgeDocument`
--
ALTER TABLE `KnowledgeDocument`
  ADD PRIMARY KEY (`id`),
  ADD KEY `KnowledgeDocument_workspaceId_idx` (`workspaceId`);

--
-- Indexes for table `Lead`
--
ALTER TABLE `Lead`
  ADD PRIMARY KEY (`id`),
  ADD KEY `Lead_workspaceId_idx` (`workspaceId`),
  ADD KEY `Lead_instagramAccountId_idx` (`instagramAccountId`),
  ADD KEY `Lead_userId_idx` (`userId`),
  ADD KEY `Lead_email_idx` (`email`),
  ADD KEY `Lead_phone_idx` (`phone`),
  ADD KEY `Lead_sourceAutomationId_fkey` (`sourceAutomationId`);

--
-- Indexes for table `LeadForm`
--
ALTER TABLE `LeadForm`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `LeadForm_slug_key` (`slug`),
  ADD KEY `LeadForm_workspaceId_idx` (`workspaceId`),
  ADD KEY `LeadForm_slug_idx` (`slug`);

--
-- Indexes for table `LeadFormSubmission`
--
ALTER TABLE `LeadFormSubmission`
  ADD PRIMARY KEY (`id`),
  ADD KEY `LeadFormSubmission_formId_idx` (`formId`),
  ADD KEY `LeadFormSubmission_workspaceId_idx` (`workspaceId`),
  ADD KEY `LeadFormSubmission_createdAt_idx` (`createdAt`);

--
-- Indexes for table `LinkClick`
--
ALTER TABLE `LinkClick`
  ADD PRIMARY KEY (`id`),
  ADD KEY `LinkClick_workspaceId_idx` (`workspaceId`),
  ADD KEY `LinkClick_automationId_idx` (`automationId`),
  ADD KEY `LinkClick_instagramAccountId_idx` (`instagramAccountId`),
  ADD KEY `LinkClick_trackedLinkId_idx` (`trackedLinkId`),
  ADD KEY `LinkClick_createdAt_idx` (`createdAt`),
  ADD KEY `LinkClick_workspaceId_createdAt_idx` (`workspaceId`,`createdAt`);

--
-- Indexes for table `OperationalEvent`
--
ALTER TABLE `OperationalEvent`
  ADD PRIMARY KEY (`id`),
  ADD KEY `OperationalEvent_workspaceId_idx` (`workspaceId`),
  ADD KEY `OperationalEvent_source_idx` (`source`),
  ADD KEY `OperationalEvent_level_idx` (`level`),
  ADD KEY `OperationalEvent_createdAt_idx` (`createdAt`);

--
-- Indexes for table `ProcessedComment`
--
ALTER TABLE `ProcessedComment`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `ProcessedComment_commentId_key` (`commentId`),
  ADD KEY `ProcessedComment_instagramAccountId_idx` (`instagramAccountId`);

--
-- Indexes for table `ProcessedMessage`
--
ALTER TABLE `ProcessedMessage`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `ProcessedMessage_mid_key` (`mid`),
  ADD KEY `ProcessedMessage_instagramAccountId_idx` (`instagramAccountId`);

--
-- Indexes for table `Session`
--
ALTER TABLE `Session`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `Session_sessionToken_key` (`sessionToken`),
  ADD KEY `Session_userId_idx` (`userId`);

--
-- Indexes for table `SystemFeatureFlag`
--
ALTER TABLE `SystemFeatureFlag`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `SystemFeatureFlag_workspaceId_featureKey_key` (`workspaceId`,`featureKey`),
  ADD KEY `SystemFeatureFlag_featureKey_idx` (`featureKey`);

--
-- Indexes for table `TrackedLink`
--
ALTER TABLE `TrackedLink`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `TrackedLink_slug_key` (`slug`),
  ADD KEY `TrackedLink_workspaceId_idx` (`workspaceId`),
  ADD KEY `TrackedLink_automationId_idx` (`automationId`);

--
-- Indexes for table `User`
--
ALTER TABLE `User`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `User_email_key` (`email`),
  ADD UNIQUE KEY `User_username_key` (`username`);

--
-- Indexes for table `VerificationToken`
--
ALTER TABLE `VerificationToken`
  ADD UNIQUE KEY `VerificationToken_identifier_token_key` (`identifier`,`token`);

--
-- Indexes for table `WebhookEvent`
--
ALTER TABLE `WebhookEvent`
  ADD PRIMARY KEY (`id`),
  ADD KEY `WebhookEvent_workspaceId_idx` (`workspaceId`),
  ADD KEY `WebhookEvent_status_idx` (`status`);

--
-- Indexes for table `Workspace`
--
ALTER TABLE `Workspace`
  ADD PRIMARY KEY (`id`),
  ADD KEY `Workspace_ownerId_idx` (`ownerId`);

--
-- Indexes for table `WorkspaceInvitation`
--
ALTER TABLE `WorkspaceInvitation`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `WorkspaceInvitation_token_key` (`token`),
  ADD UNIQUE KEY `WorkspaceInvitation_workspaceId_email_key` (`workspaceId`,`email`),
  ADD KEY `WorkspaceInvitation_email_idx` (`email`),
  ADD KEY `WorkspaceInvitation_workspaceId_idx` (`workspaceId`),
  ADD KEY `WorkspaceInvitation_status_idx` (`status`),
  ADD KEY `WorkspaceInvitation_invitedByUserId_fkey` (`invitedByUserId`);

--
-- Indexes for table `WorkspaceMember`
--
ALTER TABLE `WorkspaceMember`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `WorkspaceMember_workspaceId_userId_key` (`workspaceId`,`userId`),
  ADD KEY `WorkspaceMember_userId_idx` (`userId`);

--
-- Constraints for dumped tables
--

--
-- Constraints for table `Account`
--
ALTER TABLE `Account`
  ADD CONSTRAINT `Account_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `AiAuditLog`
--
ALTER TABLE `AiAuditLog`
  ADD CONSTRAINT `AiAuditLog_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `AiConfig`
--
ALTER TABLE `AiConfig`
  ADD CONSTRAINT `AiConfig_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `AiConversationMemory`
--
ALTER TABLE `AiConversationMemory`
  ADD CONSTRAINT `AiConversationMemory_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `AiGoal`
--
ALTER TABLE `AiGoal`
  ADD CONSTRAINT `AiGoal_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `Automation`
--
ALTER TABLE `Automation`
  ADD CONSTRAINT `Automation_instagramAccountId_fkey` FOREIGN KEY (`instagramAccountId`) REFERENCES `InstagramAccount` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `Automation_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `ConversationState`
--
ALTER TABLE `ConversationState`
  ADD CONSTRAINT `ConversationState_automationId_fkey` FOREIGN KEY (`automationId`) REFERENCES `Automation` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `ConversationState_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `CouponCode`
--
ALTER TABLE `CouponCode`
  ADD CONSTRAINT `CouponCode_poolId_fkey` FOREIGN KEY (`poolId`) REFERENCES `CouponPool` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `CouponPool`
--
ALTER TABLE `CouponPool`
  ADD CONSTRAINT `CouponPool_automationId_fkey` FOREIGN KEY (`automationId`) REFERENCES `Automation` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `CouponPool_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `DmLog`
--
ALTER TABLE `DmLog`
  ADD CONSTRAINT `DmLog_automationId_fkey` FOREIGN KEY (`automationId`) REFERENCES `Automation` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `DmLog_instagramAccountId_fkey` FOREIGN KEY (`instagramAccountId`) REFERENCES `InstagramAccount` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `DmLog_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `FaqItem`
--
ALTER TABLE `FaqItem`
  ADD CONSTRAINT `FaqItem_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `Giveaway`
--
ALTER TABLE `Giveaway`
  ADD CONSTRAINT `Giveaway_automationId_fkey` FOREIGN KEY (`automationId`) REFERENCES `Automation` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `Giveaway_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `GiveawayParticipant`
--
ALTER TABLE `GiveawayParticipant`
  ADD CONSTRAINT `GiveawayParticipant_giveawayId_fkey` FOREIGN KEY (`giveawayId`) REFERENCES `Giveaway` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `GiveawayWinner`
--
ALTER TABLE `GiveawayWinner`
  ADD CONSTRAINT `GiveawayWinner_giveawayId_fkey` FOREIGN KEY (`giveawayId`) REFERENCES `Giveaway` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `GiveawayWinner_participantId_fkey` FOREIGN KEY (`participantId`) REFERENCES `GiveawayParticipant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `InstagramAccount`
--
ALTER TABLE `InstagramAccount`
  ADD CONSTRAINT `InstagramAccount_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `KnowledgeChunk`
--
ALTER TABLE `KnowledgeChunk`
  ADD CONSTRAINT `KnowledgeChunk_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `KnowledgeDocument` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `KnowledgeDocument`
--
ALTER TABLE `KnowledgeDocument`
  ADD CONSTRAINT `KnowledgeDocument_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `Lead`
--
ALTER TABLE `Lead`
  ADD CONSTRAINT `Lead_sourceAutomationId_fkey` FOREIGN KEY (`sourceAutomationId`) REFERENCES `Automation` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `Lead_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `LeadForm`
--
ALTER TABLE `LeadForm`
  ADD CONSTRAINT `LeadForm_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `LeadFormSubmission`
--
ALTER TABLE `LeadFormSubmission`
  ADD CONSTRAINT `LeadFormSubmission_formId_fkey` FOREIGN KEY (`formId`) REFERENCES `LeadForm` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `LeadFormSubmission_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `LinkClick`
--
ALTER TABLE `LinkClick`
  ADD CONSTRAINT `LinkClick_automationId_fkey` FOREIGN KEY (`automationId`) REFERENCES `Automation` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `LinkClick_instagramAccountId_fkey` FOREIGN KEY (`instagramAccountId`) REFERENCES `InstagramAccount` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `LinkClick_trackedLinkId_fkey` FOREIGN KEY (`trackedLinkId`) REFERENCES `TrackedLink` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `LinkClick_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `OperationalEvent`
--
ALTER TABLE `OperationalEvent`
  ADD CONSTRAINT `OperationalEvent_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `Session`
--
ALTER TABLE `Session`
  ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `TrackedLink`
--
ALTER TABLE `TrackedLink`
  ADD CONSTRAINT `TrackedLink_automationId_fkey` FOREIGN KEY (`automationId`) REFERENCES `Automation` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `TrackedLink_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `WebhookEvent`
--
ALTER TABLE `WebhookEvent`
  ADD CONSTRAINT `WebhookEvent_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `Workspace`
--
ALTER TABLE `Workspace`
  ADD CONSTRAINT `Workspace_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `WorkspaceInvitation`
--
ALTER TABLE `WorkspaceInvitation`
  ADD CONSTRAINT `WorkspaceInvitation_invitedByUserId_fkey` FOREIGN KEY (`invitedByUserId`) REFERENCES `User` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `WorkspaceInvitation_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `WorkspaceMember`
--
ALTER TABLE `WorkspaceMember`
  ADD CONSTRAINT `WorkspaceMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `WorkspaceMember_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
