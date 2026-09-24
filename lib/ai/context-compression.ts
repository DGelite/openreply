import { getFeatureConfig, isFeatureEnabled } from "@/lib/flags/feature-flags";

export interface ChatMessageTurn {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function compressConversationMemory(
  history: ChatMessageTurn[],
  workspaceId?: string
): Promise<ChatMessageTurn[]> {
  const enabled = await isFeatureEnabled("AI_COMPRESSION", workspaceId);
  if (!enabled || history.length <= 4) {
    return history;
  }

  const config = await getFeatureConfig("AI_COMPRESSION", workspaceId);
  const maxTurns = config.maxTurns || 5;

  if (history.length <= maxTurns) {
    return history;
  }

  // Preserve initial system prompt if exists
  const systemPrompt = history.find((m) => m.role === "system");
  const nonSystemHistory = history.filter((m) => m.role !== "system");

  // Keep the last N turns intact
  const recentTurns = nonSystemHistory.slice(-maxTurns);
  const olderTurns = nonSystemHistory.slice(0, nonSystemHistory.length - maxTurns);

  // Compress older turns into a single summary snippet
  const summarySnippet = olderTurns
    .map((m) => `${m.role === "user" ? "کاربر" : "دستیار"}: ${m.content}`)
    .join(" | ");

  const compressedSummaryTurn: ChatMessageTurn = {
    role: "user",
    content: `[خلاصه گفتگوهای قبلی: ${summarySnippet}]`,
  };

  const result: ChatMessageTurn[] = [];
  if (systemPrompt) result.push(systemPrompt);
  result.push(compressedSummaryTurn);
  result.push(...recentTurns);

  return result;
}
