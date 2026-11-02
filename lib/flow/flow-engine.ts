/**
 * OpenReply Visual Flow Engine
 * Traverses visual flow nodes, evaluates conditions, triggers DM sends,
 * collects inputs, and dispatches webhooks.
 */

import {
  FlowGraph,
  FlowNode,
  FlowEdge,
  FlowButton,
  CarouselCard,
  QuickReplyChip,
} from "./types";
import { matchKeywords } from "@/lib/utils/keyword-matcher";
import { selectDmMessageVariation } from "@/lib/automation/ab-testing";
import { dispatchOutboundLeadWebhook } from "@/lib/automation/outbound-webhook";
import { prisma } from "@/lib/db/client";
import { providerManager } from "@/lib/providers/manager/provider-manager";

export interface FlowExecutionContext {
  workspaceId: string;
  instagramAccountId: string;
  accountId?: string;
  userId: string;
  username?: string;
  userMessage?: string;
  hasEmail?: boolean;
  hasPhone?: boolean;
  isFollowing?: boolean;
  userTags?: string[];
  selectedQuickReplyPayload?: string;
  clickedButtonPayload?: string;
}

export interface FlowStepResult {
  nodeId: string;
  nodeType: string;
  actionTaken: string;
  nextStepNodeId?: string;
  dmMessageToSend?: string;
  buttons?: FlowButton[];
  linkButton?: { label: string; url: string };
  mediaToSend?: { mediaType: "image" | "video" | "audio"; mediaUrl: string; caption?: string };
  carouselToSend?: { cards: CarouselCard[] };
  quickRepliesToSend?: { text: string; chips: QuickReplyChip[] };
  requiresInput?: "AWAITING_EMAIL" | "AWAITING_PHONE" | "FLOW_NODE";
  tagAction?: { action: "add" | "remove"; tagName: string };
  enrollDripCampaignId?: string;
  isAiReply?: boolean;
  aiInstruction?: string;
  isHumanHandover?: boolean;
  delayMinutes?: number;
}

/**
 * Evaluates a condition node against the current execution context.
 */
export function evaluateConditionNode(
  node: FlowNode,
  context: FlowExecutionContext
): boolean {
  if (node.data.type !== "condition") return false;
  const { variable, operator, value } = node.data.config;

  switch (variable) {
    case "has_email":
      return Boolean(context.hasEmail);
    case "has_phone":
      return Boolean(context.hasPhone);
    case "is_following":
      return Boolean(context.isFollowing);
    case "has_tag":
      if (!value || !context.userTags) return false;
      return context.userTags.includes(value.trim().toLowerCase());
    case "keyword_match":
      if (!context.userMessage || !value) return false;
      return matchKeywords(context.userMessage, [value], true).matched;
    default:
      return false;
  }
}

/**
 * Traverses a flow graph starting from a trigger node or a specific resume node.
 */
export async function executeFlowGraph(
  graph: FlowGraph,
  context: FlowExecutionContext,
  startNodeId?: string
): Promise<FlowStepResult[]> {
  const results: FlowStepResult[] = [];

  let currentNodeId: string | undefined;

  if (startNodeId) {
    currentNodeId = startNodeId;
  } else {
    const triggerNode = graph.nodes.find((n) => n.type === "trigger");
    if (!triggerNode || triggerNode.data.type !== "trigger") {
      return results;
    }

    // Check trigger match if user message is provided
    if (context.userMessage && triggerNode.data.config.triggerType === "COMMENT_KEYWORD") {
      const config = triggerNode.data.config;
      const match = config.matchAnyWord
        ? { matched: true, matchedKeyword: null }
        : matchKeywords(context.userMessage, config.keywords, config.wholeWordMatch);

      if (!match.matched) {
        return results;
      }
    }

    results.push({
      nodeId: triggerNode.id,
      nodeType: "trigger",
      actionTaken: "TRIGGER_MATCHED",
    });

    const firstEdge = graph.edges.find((e) => e.sourceNodeId === triggerNode.id);
    currentNodeId = firstEdge?.targetNodeId;
  }

  const visitedNodes = new Set<string>();

  while (currentNodeId && !visitedNodes.has(currentNodeId)) {
    visitedNodes.add(currentNodeId);
    const currentNode = graph.nodes.find((n) => n.id === currentNodeId);
    if (!currentNode) break;

    // 1. Process Send DM Node
    if (currentNode.type === "send_dm" && currentNode.data.type === "send_dm") {
      const config = currentNode.data.config;
      const messageText = selectDmMessageVariation(config.message);

      results.push({
        nodeId: currentNode.id,
        nodeType: "send_dm",
        actionTaken: "SEND_DM",
        dmMessageToSend: messageText,
        buttons: config.buttons,
        linkButton:
          config.buttonLabel && config.buttonUrl
            ? { label: config.buttonLabel, url: config.buttonUrl }
            : undefined,
      });
    }

    // 2. Process Send Media Node
    else if (currentNode.type === "send_media" && currentNode.data.type === "send_media") {
      const config = currentNode.data.config;
      results.push({
        nodeId: currentNode.id,
        nodeType: "send_media",
        actionTaken: `SEND_MEDIA_${config.mediaType.toUpperCase()}`,
        mediaToSend: {
          mediaType: config.mediaType,
          mediaUrl: config.mediaUrl,
          caption: config.caption,
        },
      });
    }

    // 3. Process Send Carousel Node
    else if (currentNode.type === "send_carousel" && currentNode.data.type === "send_carousel") {
      const config = currentNode.data.config;
      results.push({
        nodeId: currentNode.id,
        nodeType: "send_carousel",
        actionTaken: "SEND_CAROUSEL",
        carouselToSend: {
          cards: config.cards,
        },
      });
    }

    // 4. Process Quick Reply Node
    else if (currentNode.type === "quick_reply" && currentNode.data.type === "quick_reply") {
      const config = currentNode.data.config;
      results.push({
        nodeId: currentNode.id,
        nodeType: "quick_reply",
        actionTaken: "SEND_QUICK_REPLIES",
        quickRepliesToSend: {
          text: config.text,
          chips: config.chips,
        },
        requiresInput: "FLOW_NODE",
      });
      // Pause until user selects a chip
      break;
    }

    // 5. Process Condition Node
    else if (currentNode.type === "condition" && currentNode.data.type === "condition") {
      if (
        currentNode.data.config.variable === "is_following" &&
        context.isFollowing === undefined
      ) {
        try {
          const account = context.accountId
            ? { id: context.accountId }
            : await prisma.instagramAccount.findUnique({
                where: { instagramId: context.instagramAccountId },
                select: { id: true },
              });
          if (account?.id) {
            context.isFollowing = await providerManager.checkFollowStatus(
              account.id,
              context.userId
            );
          }
        } catch {
          context.isFollowing = false;
        }
      }

      const conditionPassed = evaluateConditionNode(currentNode, context);
      const targetBranch = conditionPassed ? "yes" : "no";

      results.push({
        nodeId: currentNode.id,
        nodeType: "condition",
        actionTaken: `EVALUATE_CONDITION_${targetBranch.toUpperCase()}`,
      });

      const nextEdge = graph.edges.find(
        (e) => e.sourceNodeId === currentNode.id && e.conditionBranch === targetBranch
      );
      const fallbackEdge = graph.edges.find(
        (e) => e.sourceNodeId === currentNode.id && !e.conditionBranch
      );
      currentNodeId = nextEdge?.targetNodeId ?? fallbackEdge?.targetNodeId;
      continue;
    }

    // 6. Process Collect Input Node
    else if (currentNode.type === "collect_input" && currentNode.data.type === "collect_input") {
      const config = currentNode.data.config;
      const inputStep = config.inputType === "email" ? "AWAITING_EMAIL" : "AWAITING_PHONE";

      results.push({
        nodeId: currentNode.id,
        nodeType: "collect_input",
        actionTaken: "PROMPT_USER_INPUT",
        dmMessageToSend: config.promptMessage,
        requiresInput: inputStep,
      });

      // Stop traversal until user responds with email/phone
      break;
    }

    // 7. Process Tagging Nodes
    else if (currentNode.type === "add_tag" && currentNode.data.type === "add_tag") {
      results.push({
        nodeId: currentNode.id,
        nodeType: "add_tag",
        actionTaken: `ADD_TAG_${currentNode.data.config.tagName}`,
        tagAction: { action: "add", tagName: currentNode.data.config.tagName },
      });
    } else if (currentNode.type === "remove_tag" && currentNode.data.type === "remove_tag") {
      results.push({
        nodeId: currentNode.id,
        nodeType: "remove_tag",
        actionTaken: `REMOVE_TAG_${currentNode.data.config.tagName}`,
        tagAction: { action: "remove", tagName: currentNode.data.config.tagName },
      });
    }

    // 8. Process Drip Enrollment Node
    else if (currentNode.type === "enroll_drip" && currentNode.data.type === "enroll_drip") {
      results.push({
        nodeId: currentNode.id,
        nodeType: "enroll_drip",
        actionTaken: `ENROLL_DRIP_${currentNode.data.config.campaignId}`,
        enrollDripCampaignId: currentNode.data.config.campaignId,
      });
    }

    // 9. Process AI Reply Node
    else if (currentNode.type === "ai_reply" && currentNode.data.type === "ai_reply") {
      results.push({
        nodeId: currentNode.id,
        nodeType: "ai_reply",
        actionTaken: "DISPATCH_AI_REPLY",
        isAiReply: true,
        aiInstruction: currentNode.data.config.instruction,
      });
      // AI node delivers dynamic response and completes turn
      break;
    }

    // 10. Process Handover to Human Node
    else if (
      currentNode.type === "handover_to_human" &&
      currentNode.data.type === "handover_to_human"
    ) {
      results.push({
        nodeId: currentNode.id,
        nodeType: "handover_to_human",
        actionTaken: "HANDOVER_TO_HUMAN",
        isHumanHandover: true,
        dmMessageToSend: currentNode.data.config.notificationMessage,
      });
      break;
    }

    // 11. Process Webhook Action Node
    else if (currentNode.type === "webhook_action" && currentNode.data.type === "webhook_action") {
      const config = currentNode.data.config;
      void dispatchOutboundLeadWebhook(
        {
          username: context.username,
          igsid: context.userId,
          workspaceId: context.workspaceId,
          customData: { flowNodeId: currentNode.id, message: context.userMessage },
        },
        config.webhookUrl
      );

      results.push({
        nodeId: currentNode.id,
        nodeType: "webhook_action",
        actionTaken: "DISPATCH_WEBHOOK",
      });
    }

    // 12. Process Smart Delay Node
    else if (currentNode.type === "smart_delay" && currentNode.data.type === "smart_delay") {
      const config = currentNode.data.config;
      results.push({
        nodeId: currentNode.id,
        nodeType: "smart_delay",
        actionTaken: `SMART_DELAY_${config.delayMinutes}_MINUTES`,
        delayMinutes: config.delayMinutes,
      });
    }

    // Find next edge based on selected handle/payload or default
    let outgoingEdge: FlowEdge | undefined;

    if (context.selectedQuickReplyPayload) {
      outgoingEdge = graph.edges.find(
        (e) =>
          e.sourceNodeId === currentNode.id &&
          (e.sourceHandle === context.selectedQuickReplyPayload ||
            e.conditionBranch === context.selectedQuickReplyPayload)
      );
    }

    if (!outgoingEdge) {
      outgoingEdge = graph.edges.find((e) => e.sourceNodeId === currentNode.id);
    }

    currentNodeId = outgoingEdge?.targetNodeId;
  }

  return results;
}
