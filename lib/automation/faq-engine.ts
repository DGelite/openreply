import { prisma } from "@/lib/db/client";
import { matchKeywords } from "@/lib/utils/keyword-matcher";

export interface FaqMatchResult {
  matched: boolean;
  faqId?: string;
  question?: string;
  answerText?: string;
  linkUrl?: string;
}

/**
 * Searches for a matching FAQ item based on the user's incoming message.
 */
export async function matchFaq(params: {
  workspaceId: string;
  instagramAccountId: string;
  messageText: string;
}): Promise<FaqMatchResult> {
  const { workspaceId, instagramAccountId, messageText } = params;

  if (!messageText || messageText.trim().length === 0) {
    return { matched: false };
  }

  const faqItems = await prisma.faqItem.findMany({
    where: {
      workspaceId,
      instagramAccountId,
      isActive: true,
    },
    orderBy: { order: "asc" },
  });

  for (const faq of faqItems) {
    const keywords = (faq.keywords as string[]) || [];

    // Match keywords using OpenReply's robust keyword matcher
    const match = matchKeywords(messageText, keywords, false);

    if (match.matched) {
      return {
        matched: true,
        faqId: faq.id,
        question: faq.question,
        answerText: faq.answerText,
        linkUrl: faq.linkUrl ?? undefined,
      };
    }
  }

  return { matched: false };
}
