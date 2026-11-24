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
  FlowStepResult,
} from "./types";

export type { FlowStepResult };
import { matchKeywords } from "@/lib/utils/keyword-matcher";
import { selectDmMessageVariation } from "@/lib/automation/ab-testing";
import { dispatchOutboundLeadWebhook } from "@/lib/automation/outbound-webhook";
import { prisma } from "@/lib/db/client";
import { providerManager } from "@/lib/providers/manager/provider-manager";

export interface FlowExecutionContext {
  workspaceId: string;
  instagramAccountId: string;
  accountId?: string;
  automationId?: string;
  userId: string;
  username?: string;
  userMessage?: string;
  hasEmail?: boolean;
  hasPhone?: boolean;
  isFollowing?: boolean;
  userTags?: string[];
  selectedQuickReplyPayload?: string;
  clickedButtonPayload?: string;
  clickedButtonId?: string;
  isSimulation?: boolean;
}



/**
 * Evaluates a condition node against the current execution context.
 * Seamlessly supports both UI schema (ruleType/tagName/textValue) and API schema (variable/value/operator).
 */
export function evaluateConditionNode(
  node: FlowNode,
  context: FlowExecutionContext
): boolean {
  if (node.data.type !== "condition") return false;
  const config = node.data.config as any;

  const ruleType = config.ruleType || config.variable;
  const targetTag = (config.tagName || config.value || "").trim().toLowerCase();
  const textVal = config.matchText || config.textValue || config.value || "";

  switch (ruleType) {
    case "EMAIL_PROVIDED":
    case "has_email":
      return Boolean(context.hasEmail);
    case "PHONE_PROVIDED":
    case "has_phone":
      return Boolean(context.hasPhone);
    case "is_following":
      return Boolean(context.isFollowing);
    case "HAS_TAG":
    case "has_tag":
      if (!targetTag || !context.userTags) return false;
      return context.userTags.some((t) => t.trim().toLowerCase() === targetTag);
    case "TEXT_CONTAINS":
    case "keyword_match":
      if (!context.userMessage || !textVal) return false;
      return matchKeywords(context.userMessage, [textVal], false).matched;
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
    if (
      context.userMessage &&
      (triggerNode.data.config.triggerType === "ALL" ||
        triggerNode.data.config.triggerType === "COMMENT_KEYWORD" ||
        triggerNode.data.config.triggerType === "DIRECT_MESSAGE")
    ) {
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

    // Resumption check: If resuming at a quick_reply node because the user tapped a chip or responded
    if (currentNode.id === startNodeId && currentNode.type === "quick_reply") {
      const rawChips = (currentNode.data as any)?.config?.chips || (currentNode.data as any)?.config?.quickReplies || [];
      const candidateInput = context.selectedQuickReplyPayload || context.userMessage;
      const matchingChip = rawChips.find(
        (c: any) =>
          candidateInput &&
          (c.payload === candidateInput ||
            c.title === candidateInput ||
            c.id === candidateInput)
      );

      if (matchingChip || context.selectedQuickReplyPayload) {
        let outgoingEdge = graph.edges.find(
          (e) =>
            e.sourceNodeId === currentNode.id &&
            ((candidateInput &&
              (e.sourceHandle === candidateInput ||
                e.conditionBranch === candidateInput)) ||
              (matchingChip &&
                (e.sourceHandle === matchingChip.id ||
                  e.sourceHandle === matchingChip.payload ||
                  e.conditionBranch === matchingChip.id ||
                  e.conditionBranch === matchingChip.payload)))
        );
        if (!outgoingEdge) {
          outgoingEdge = graph.edges.find((e) => e.sourceNodeId === currentNode.id);
        }
        currentNodeId = outgoingEdge?.targetNodeId;
        continue;
      }
    }

    // Resumption check: If resuming at a send_dm parent node because user clicked a postback button
    if (currentNode.id === startNodeId && currentNode.type === "send_dm") {
      const rawButtons = Array.isArray((currentNode.data as any)?.config?.buttons)
        ? (currentNode.data as any).config.buttons
        : [];
      const hasMatchingButton = rawButtons.some(
        (b: any) =>
          (context.clickedButtonId && b.id === context.clickedButtonId) ||
          (context.clickedButtonPayload &&
            (b.payload === context.clickedButtonPayload || b.id === context.clickedButtonPayload))
      );

      if (hasMatchingButton) {
        let outgoingEdge = graph.edges.find(
          (e) =>
            e.sourceNodeId === currentNode.id &&
            ((context.clickedButtonId &&
              (e.sourceHandle === context.clickedButtonId || e.conditionBranch === context.clickedButtonId)) ||
              (context.clickedButtonPayload &&
                (e.sourceHandle === context.clickedButtonPayload || e.conditionBranch === context.clickedButtonPayload)))
        );
        if (!outgoingEdge) {
          outgoingEdge = graph.edges.find((e) => e.sourceNodeId === currentNode.id);
        }
        currentNodeId = outgoingEdge?.targetNodeId;
        continue;
      }
    }

    // 1. Process Send DM Node
    if (currentNode.type === "send_dm" && currentNode.data.type === "send_dm") {
      const config = currentNode.data.config as any;
      const rawMessage = config.message || config.messageText || "";
      const messageText = selectDmMessageVariation(rawMessage);

      // Prepare buttons with stable IDs and payloads
      const rawButtons = Array.isArray(config.buttons) ? config.buttons : [];
      const buttons: FlowButton[] = rawButtons.map((b: any, bIdx: number) => {
        const btnId = b.id || `btn_${bIdx + 1}`;
        const btnType = b.type || (b.url ? "web_url" : "postback");
        const payload =
          b.payload ||
          (btnType === "postback"
            ? `flow_btn:${context.automationId || "flow"}:${currentNode.id}:${btnId}`
            : undefined);
        return {
          id: btnId,
          type: btnType,
          title: b.title || `دکمه ${bIdx + 1}`,
          url: b.url,
          payload,
        };
      });

      // Check if any postback button has an outgoing branch edge
      const postbackButtonIds = new Set(
        buttons.filter((b) => b.type === "postback").map((b) => b.id)
      );
      const hasBranchingButtons = graph.edges.some(
        (e) =>
          e.sourceNodeId === currentNode.id &&
          e.sourceHandle &&
          postbackButtonIds.has(e.sourceHandle)
      );

      results.push({
        nodeId: currentNode.id,
        nodeType: "send_dm",
        actionTaken: "SEND_DM",
        dmMessageToSend: messageText,
        buttons: buttons.length > 0 ? buttons : undefined,
        linkButton:
          config.buttonLabel && config.buttonUrl
            ? { label: config.buttonLabel, url: config.buttonUrl }
            : undefined,
        requiresInput: hasBranchingButtons ? "FLOW_NODE" : undefined,
      });

      if (hasBranchingButtons) {
        // ManyChat behavior: Pause traversal and wait for user's button postback click
        break;
      }
    }

    // 2. Process Send Media Node
    else if (currentNode.type === "send_media" && currentNode.data.type === "send_media") {
      const config = currentNode.data.config as any;
      results.push({
        nodeId: currentNode.id,
        nodeType: "send_media",
        actionTaken: `SEND_MEDIA_${(config.mediaType || "IMAGE").toUpperCase()}`,
        mediaToSend: {
          mediaType: config.mediaType || "image",
          mediaUrl: config.mediaUrl,
          caption: config.caption,
        },
      });
    }

    // 3. Process Send Carousel Node
    else if (currentNode.type === "send_carousel" && currentNode.data.type === "send_carousel") {
      const config = currentNode.data.config as any;
      const rawCards = config.cards || config.elements || [];
      const cards: CarouselCard[] = rawCards.map((c: any, idx: number) => ({
        id: c.id || `card_${idx + 1}`,
        title: c.title || "",
        subtitle: c.subtitle || "",
        imageUrl: c.imageUrl || c.image_url || "",
        buttons: (c.buttons || []).map((b: any, bIdx: number) => ({
          id: b.id || `btn_${bIdx + 1}`,
          type: b.type || "web_url",
          title: b.title || "مشاهده",
          url: b.url || "",
          payload: b.payload,
        })),
      }));

      results.push({
        nodeId: currentNode.id,
        nodeType: "send_carousel",
        actionTaken: "SEND_CAROUSEL",
        carouselToSend: {
          cards,
        },
      });
    }

    // 4. Process Quick Reply Node
    else if (currentNode.type === "quick_reply" && currentNode.data.type === "quick_reply") {
      const config = currentNode.data.config as any;
      const text = config.text || config.messageText || "یک گزینه را انتخاب کنید:";
      const rawChips = config.chips || config.quickReplies || [];
      const chips: QuickReplyChip[] = rawChips.map((c: any, idx: number) => ({
        id: c.id || `chip_${idx + 1}`,
        title: c.title || `گزینه ${idx + 1}`,
        payload: c.payload || c.title || `choice_${idx + 1}`,
      }));

      results.push({
        nodeId: currentNode.id,
        nodeType: "quick_reply",
        actionTaken: "SEND_QUICK_REPLIES",
        quickRepliesToSend: {
          text,
          chips,
        },
        requiresInput: "FLOW_NODE",
      });
      // Pause until user selects a chip
      break;
    }

    // 5. Process Condition Node
    else if (currentNode.type === "condition" && currentNode.data.type === "condition") {
      const condCfg = currentNode.data.config as any;
      const rule = condCfg.ruleType || condCfg.variable;

      if (
        rule === "is_following" &&
        context.isFollowing === undefined &&
        !context.isSimulation
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

      if (
        !context.isSimulation &&
        ((rule === "EMAIL_PROVIDED" || rule === "has_email") && context.hasEmail === undefined ||
          (rule === "PHONE_PROVIDED" || rule === "has_phone") && context.hasPhone === undefined)
      ) {
        try {
          const lead = await prisma.lead.findUnique({
            where: { id: `lead_${context.instagramAccountId}_${context.userId}` },
            select: { email: true, phone: true },
          });
          if (context.hasEmail === undefined) context.hasEmail = Boolean(lead?.email);
          if (context.hasPhone === undefined) context.hasPhone = Boolean(lead?.phone);
        } catch {
          // Ignore DB lookup errors in unit tests
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
        (e) =>
          e.sourceNodeId === currentNode.id &&
          (e.conditionBranch === targetBranch || e.sourceHandle === targetBranch)
      );
      const fallbackEdge = graph.edges.find(
        (e) => e.sourceNodeId === currentNode.id && !e.conditionBranch && !e.sourceHandle
      );
      currentNodeId = nextEdge?.targetNodeId ?? fallbackEdge?.targetNodeId;
      continue;
    }

    // 6. Process Collect Input Node
    else if (currentNode.type === "collect_input" && currentNode.data.type === "collect_input") {
      const config = currentNode.data.config as any;
      const inputStep = config.inputType === "email" ? "AWAITING_EMAIL" : "AWAITING_PHONE";
      const prompt =
        config.promptMessage ||
        (config.inputType === "email"
          ? "لطفاً ایمیلتون رو برام بفرستید:"
          : config.inputType === "name"
          ? "سلام! لطفاً اسم و فامیلتون رو برام بنویسید 🙏"
          : "لطفاً شماره موبایلتون رو برام بفرستید 📱");

      results.push({
        nodeId: currentNode.id,
        nodeType: "collect_input",
        actionTaken: "PROMPT_USER_INPUT",
        dmMessageToSend: prompt,
        requiresInput: inputStep,
      });

      // Stop traversal until user responds
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
      const config = currentNode.data.config as any;
      results.push({
        nodeId: currentNode.id,
        nodeType: "ai_reply",
        actionTaken: "DISPATCH_AI_REPLY",
        isAiReply: true,
        aiInstruction: config.instruction || config.prompt,
      });
      // AI node delivers dynamic response and completes turn
      break;
    }

    // 10. Process Handover to Human Node
    else if (
      currentNode.type === "handover_to_human" &&
      currentNode.data.type === "handover_to_human"
    ) {
      const config = currentNode.data.config as any;
      results.push({
        nodeId: currentNode.id,
        nodeType: "handover_to_human",
        actionTaken: "HANDOVER_TO_HUMAN",
        isHumanHandover: true,
        dmMessageToSend: config.notificationMessage || undefined,
      });
      break;
    }

    // 11. Process Webhook Action Node
    else if (currentNode.type === "webhook_action" && currentNode.data.type === "webhook_action") {
      const config = currentNode.data.config;
      const targetUrl = (config.webhookUrl || "").trim();
      const isPlaceholder = !targetUrl || targetUrl.includes("hooks.zapier.com/...");

      if (!context.isSimulation && !isPlaceholder) {
        let extraData: Record<string, unknown> = {};
        if (config.customPayloadJson) {
          try {
            extraData = JSON.parse(config.customPayloadJson);
          } catch {
            extraData = { rawPayload: config.customPayloadJson };
          }
        }

        if (config.httpMethod === "GET") {
          const url = new URL(targetUrl);
          url.searchParams.set("igsid", context.userId);
          if (context.username) url.searchParams.set("username", context.username);
          void fetch(url.toString(), { method: "GET", signal: AbortSignal.timeout(5000) }).catch(() => {});
        } else {
          void dispatchOutboundLeadWebhook(
            {
              username: context.username,
              igsid: context.userId,
              workspaceId: context.workspaceId,
              customData: {
                flowNodeId: currentNode.id,
                message: context.userMessage,
                ...extraData,
              },
            },
            targetUrl
          );
        }
      }

      results.push({
        nodeId: currentNode.id,
        nodeType: "webhook_action",
        actionTaken: "DISPATCH_WEBHOOK",
      });
    }

    // 12. Process Smart Delay Node
    else if (currentNode.type === "smart_delay" && currentNode.data.type === "smart_delay") {
      const config = currentNode.data.config as any;
      let delayMs = 0;
      let delayMinutes = config.delayMinutes;

      if (config.delayAmount) {
        const unit = config.delayUnit || "minutes";
        const amount = Math.max(1, Number(config.delayAmount) || 5);
        if (unit === "seconds") {
          delayMs = amount * 1000;
          delayMinutes = Math.max(1, Math.ceil(amount / 60));
        } else if (unit === "hours") {
          delayMs = amount * 60 * 60 * 1000;
          delayMinutes = amount * 60;
        } else if (unit === "days") {
          delayMs = amount * 24 * 60 * 60 * 1000;
          delayMinutes = amount * 1440;
        } else {
          delayMs = amount * 60 * 1000;
          delayMinutes = amount;
        }
      } else {
        delayMinutes = Math.max(1, Number(delayMinutes) || 5);
        delayMs = delayMinutes * 60 * 1000;
      }

      const nextEdge = graph.edges.find((e) => e.sourceNodeId === currentNode.id);

      results.push({
        nodeId: currentNode.id,
        nodeType: "smart_delay",
        actionTaken: `SMART_DELAY_${delayMinutes}_MINUTES`,
        delayMinutes,
        delayMs,
        nextStepNodeId: nextEdge?.targetNodeId,
      });

      // In live runtime, pause here so the worker schedules the remaining branch after delayMs
      if (!context.isSimulation && nextEdge?.targetNodeId) {
        break;
      }
    }

    // Find next edge based on selected handle/payload or default
    let outgoingEdge: FlowEdge | undefined;

    if (context.clickedButtonId || context.clickedButtonPayload) {
      outgoingEdge = graph.edges.find(
        (e) =>
          e.sourceNodeId === currentNode.id &&
          ((context.clickedButtonId &&
            (e.sourceHandle === context.clickedButtonId || e.conditionBranch === context.clickedButtonId)) ||
            (context.clickedButtonPayload &&
              (e.sourceHandle === context.clickedButtonPayload || e.conditionBranch === context.clickedButtonPayload)))
      );
    }

    if (!outgoingEdge && context.selectedQuickReplyPayload) {
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
