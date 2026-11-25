export type TriggerScope = "specific" | "any" | "next";
export type MatchMode = "specific" | "any";

export interface LoadedCampaign {
  id: string;
  name: string;
  postId: string | null;
  postUrl: string | null;
  pendingNextReel: boolean;
  matchAnyPost: boolean;
  keywords: string[];
  matchAnyWord: boolean;
  dmMessage: string;
  openingDmEnabled: boolean;
  openingDmMessage: string | null;
  openingDmButtonLabel: string | null;
  linkButtonLabel: string | null;
  publicReplyEnabled: boolean;
  publicReplyMessage: string | null;
  publicReplyMessages: string[];
  isActive: boolean;
  instagramAccountId: string;
  collectName?: boolean;
  leadPromptName?: string | null;
  collectPhone?: boolean;
  leadPromptPhone?: string | null;
  singleStepLeadCapture?: boolean;
  leadPromptBoth?: string | null;
  leadSuccessMessage?: string | null;
  collectPhoneSkipOtp?: boolean;
  autoVerifyAndBook?: boolean;
  confirmBeforeSave?: boolean;
  confirmMessage?: string | null;
  flowGraph?: { nodes?: unknown[] } | null;
  trackedLinks?: { destinationUrl: string }[];
}

export interface CampaignBuilderProps {
  mode: "new" | "edit";
  campaignId?: string;
}
