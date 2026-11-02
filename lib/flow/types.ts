/**
 * ManyChat / Inistam Visual Flow Builder Data Types
 * Defines nodes, edges, trigger types, condition rules, and execution states.
 */

export type FlowNodeType =
  | "trigger"
  | "send_dm"
  | "send_media"
  | "send_carousel"
  | "quick_reply"
  | "condition"
  | "collect_input"
  | "add_tag"
  | "remove_tag"
  | "enroll_drip"
  | "ai_reply"
  | "handover_to_human"
  | "webhook_action"
  | "smart_delay";

export type FlowTriggerType =
  | "COMMENT_KEYWORD"
  | "STORY_REPLY"
  | "STORY_MENTION"
  | "STORY_REACTION"
  | "DIRECT_MESSAGE"
  | "WELCOME";

export interface FlowNodePosition {
  x: number;
  y: number;
}

export interface TriggerNodeData {
  triggerType: FlowTriggerType;
  keywords: string[];
  matchAnyPost?: boolean;
  matchAnyWord: boolean;
  wholeWordMatch: boolean;
}

export interface FlowButton {
  id: string;
  type: "web_url" | "postback";
  title: string;
  url?: string;
  payload?: string;
}

export interface SendDmNodeData {
  message: string;
  variations?: string[];
  buttonLabel?: string;
  buttonUrl?: string;
  buttons?: FlowButton[];
  publicReplyEnabled?: boolean;
  publicReplyMessages?: string[];
}

export interface SendMediaNodeData {
  mediaType: "image" | "video" | "audio";
  mediaUrl: string;
  caption?: string;
}

export interface CarouselCard {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl: string;
  buttons: FlowButton[];
}

export interface SendCarouselNodeData {
  cards: CarouselCard[];
}

export interface QuickReplyChip {
  id: string;
  title: string;
  payload: string;
}

export interface QuickReplyNodeData {
  text: string;
  chips: QuickReplyChip[];
}

export interface ConditionNodeData {
  variable: "has_email" | "has_phone" | "has_tag" | "keyword_match" | "is_following" | "custom";
  operator: "equals" | "contains" | "is_not_empty";
  value?: string;
}

export interface CollectInputNodeData {
  inputType: "email" | "phone" | "text";
  promptMessage: string;
  successMessage?: string;
  validationErrorMessage?: string;
}

export interface AddTagNodeData {
  tagName: string;
}

export interface RemoveTagNodeData {
  tagName: string;
}

export interface EnrollDripNodeData {
  campaignId: string;
}

export interface AiReplyNodeData {
  instruction?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface HandoverToHumanNodeData {
  notificationMessage?: string;
}

export interface WebhookActionNodeData {
  webhookUrl: string;
  httpMethod: "POST" | "GET";
  customPayloadJson?: string;
}

export interface SmartDelayNodeData {
  delayMinutes: number;
}

export type FlowNodeData =
  | { type: "trigger"; config: TriggerNodeData }
  | { type: "send_dm"; config: SendDmNodeData }
  | { type: "send_media"; config: SendMediaNodeData }
  | { type: "send_carousel"; config: SendCarouselNodeData }
  | { type: "quick_reply"; config: QuickReplyNodeData }
  | { type: "condition"; config: ConditionNodeData }
  | { type: "collect_input"; config: CollectInputNodeData }
  | { type: "add_tag"; config: AddTagNodeData }
  | { type: "remove_tag"; config: RemoveTagNodeData }
  | { type: "enroll_drip"; config: EnrollDripNodeData }
  | { type: "ai_reply"; config: AiReplyNodeData }
  | { type: "handover_to_human"; config: HandoverToHumanNodeData }
  | { type: "webhook_action"; config: WebhookActionNodeData }
  | { type: "smart_delay"; config: SmartDelayNodeData };

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  title: string;
  position: FlowNodePosition;
  data: FlowNodeData;
}

export interface FlowEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string;
  targetHandle?: string;
  conditionBranch?: "yes" | "no" | "default" | string;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface FlowRecord {
  id: string;
  workspaceId: string;
  instagramAccountId: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  graph: FlowGraph;
  createdAt: string;
  updatedAt: string;
}
