import { prisma } from "@/lib/db/client";
import { getAiEngine } from "../factory";
import { queryKnowledgeBase } from "./knowledge-base";

export interface SmartResponseInput {
  workspaceId: string;
  userId: string;
  userMessage: string;
  flowState?: string;
  variables?: Record<string, unknown>;
}

export async function generateSmartResponse(
  input: SmartResponseInput
): Promise<string> {
  const { workspaceId, userId, userMessage, flowState, variables } = input;

  // 1 & 2. Run Customer Profile & Conversation Memory lookups in parallel
  const [lead, memories] = await Promise.all([
    prisma.lead.findFirst({
      where: { workspaceId, userId },
      select: { name: true, username: true, email: true, phone: true },
    }),
    prisma.aiConversationMemory.findMany({
      where: { workspaceId, userId },
      take: 5,
      select: { memoryKey: true, memoryValue: true },
    }),
  ]);

  // 3. RAG Knowledge Search
  const ragDocs = await queryKnowledgeBase(workspaceId, userMessage, 2);

  // Lean prompt optimization: omit empty fields to conserve input tokens
  const profileParts: string[] = [];
  if (lead?.name || lead?.username) profileParts.push(`نام: ${lead.name || lead.username}`);
  if (lead?.email) profileParts.push(`ایمیل: ${lead.email}`);
  if (lead?.phone) profileParts.push(`شماره: ${lead.phone}`);
  const customerProfile = profileParts.join(", ");

  const memoryContext = memories.map((m) => `${m.memoryKey}: ${m.memoryValue}`).join(", ");
  const kbContext = ragDocs.map((d) => d.content).join("\n");

  const promptSections: string[] = [
    "شما موتور پاسخ‌دهی هوشمند هستید.",
  ];
  if (customerProfile) promptSections.push(`مشتری: ${customerProfile}`);
  if (memoryContext) promptSections.push(`سوابق: ${memoryContext}`);
  if (kbContext) promptSections.push(`دانش کسب‌وکار:\n${kbContext}`);
  if (flowState && flowState !== "چت آزاد") promptSections.push(`وضعیت فلو: ${flowState}`);
  if (variables && Object.keys(variables).length > 0) promptSections.push(`متغیرها: ${JSON.stringify(variables)}`);

  promptSections.push("پاسخ را کاملاً طبیعی، کوتاه، صمیمی و متناسب با نیاز کاربر بنویس. فقط متن پاسخ نهایی را خروجی بده.");
  const systemPrompt = promptSections.join("\n");

  const aiEngine = await getAiEngine(workspaceId);

  const completion = await aiEngine.generateCompletion({
    systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 250,
  });

  return completion.text.trim();
}
