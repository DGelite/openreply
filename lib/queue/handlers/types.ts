export interface AutomationWithAccountAndLinks {
  id: string;
  workspaceId: string;
  instagramAccountId: string;
  name: string;
  postId: string | null;
  matchAnyPost: boolean;
  keywords: any;
  wholeWordMatch: boolean;
  matchAnyWord: boolean;
  openingDmEnabled: boolean;
  openingDmMessage: string | null;
  openingDmButtonLabel: string | null;
  dmMessage: any;
  linkButtonLabel: string | null;
  publicReplyEnabled: boolean;
  publicReplyMessage: string | null;
  publicReplyMessages: any;
  flowGraph: any;
  isActive: boolean;
  collectName?: boolean;
  collectPhone?: boolean;
  leadPromptName?: string | null;
  leadPromptPhone?: string | null;
  singleStepLeadCapture?: boolean;
  leadPromptBoth?: string | null;
  leadSuccessMessage?: string | null;
  autoVerifyAndBook?: boolean;
  createdAt: Date;
  updatedAt: Date;
  instagramAccount: {
    id: string;
    instagramId: string;
    username: string;
    accessToken: string | null;
    workspaceId: string;
    [key: string]: any;
  };
  workspace: {
    id: string;
    name: string;
    [key: string]: any;
  };
  trackedLinks: Array<{
    slug: string;
    destinationUrl: string;
  }>;
}
