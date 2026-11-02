import { prisma } from "@/lib/db/client";
import { getAiEngine } from "../factory";
import { queryKnowledgeBase } from "./knowledge-base";
import { buildBusinessPersonaPrompt } from "./persona-engine";
import { evaluateConversationStrategy } from "./conversation-strategy";

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

  // 1. Parallel lookup of AI Config, Customer Profile, Memory, and Conversation State
  const [aiConfig, lead, memories, convState] = await Promise.all([
    prisma.aiConfig.findUnique({
      where: { workspaceId },
    }),
    prisma.lead.findFirst({
      where: { workspaceId, userId },
      select: { name: true, username: true, email: true, phone: true },
    }),
    prisma.aiConversationMemory.findMany({
      where: { workspaceId, userId },
      take: 5,
      select: { memoryKey: true, memoryValue: true },
    }),
    prisma.conversationState.findFirst({
      where: { workspaceId, userId },
      select: { id: true, extractedPhone: true, conversationStatus: true },
    }),
  ]);

  // 2. RAG Knowledge Search
  const ragDocs = await queryKnowledgeBase(workspaceId, userMessage, 3);
  const kbContext = ragDocs.map((d) => d.content).join("\n");

  // 3. Dynamic Business Persona Engine
  const personaPrompt = buildBusinessPersonaPrompt({
    assistantName: aiConfig?.assistantName,
    roleTitle: aiConfig?.roleTitle,
    businessType: aiConfig?.businessType,
    targetAudience: aiConfig?.targetAudience,
    personalityDemeanor: aiConfig?.personalityDemeanor,
    defaultTone: aiConfig?.defaultTone,
    preferredWords: Array.isArray(aiConfig?.preferredWords) ? (aiConfig.preferredWords as string[]) : [],
    forbiddenWords: Array.isArray(aiConfig?.forbiddenWords) ? (aiConfig.forbiddenWords as string[]) : [],
    unhappyClientPolicy: aiConfig?.unhappyClientPolicy,
    priceObjectionPolicy: aiConfig?.priceObjectionPolicy,
    hesitantClientPolicy: aiConfig?.hesitantClientPolicy,
    humanEscalationTriggers: Array.isArray(aiConfig?.humanEscalationTriggers)
      ? (aiConfig.humanEscalationTriggers as string[])
      : [],
  });

  // 4. Strategic Funnel Progression
  const hasPhone = Boolean(lead?.phone || convState?.extractedPhone);
  const hasEmail = Boolean(lead?.email);
  const strategy = evaluateConversationStrategy({
    primaryGoal: (aiConfig?.primaryGoal as any) || "LEAD_GENERATION",
    userMessage,
    hasPhone,
    hasEmail,
    conversationTurns: memories.length + 1,
    lastAiAskedForPhone: false,
    isUnhappy: false,
    isRequestingHuman: false,
    hasBuyingIntent: false,
  });

  // If strategy dictates escalation, update conversation state
  if (strategy.action === "ESCALATE_TO_HUMAN" && convState?.id) {
    await prisma.conversationState.update({
      where: { id: convState.id },
      data: { conversationStatus: "AWAITING_HUMAN" },
    }).catch(() => {});
  }

  // 5. Customer Profile Context (lean, omit empty fields)
  const profileParts: string[] = [];
  if (lead?.name || lead?.username) profileParts.push(`نام: ${lead.name || lead.username}`);
  if (lead?.email) profileParts.push(`ایمیل: ${lead.email}`);
  if (lead?.phone || convState?.extractedPhone) {
    profileParts.push(`شماره تماس: ${lead?.phone || convState?.extractedPhone}`);
  }
  const customerProfile = profileParts.join("، ");

  const memoryContext = memories.map((m) => `${m.memoryKey}: ${m.memoryValue}`).join("، ");

  // 6. Assemble System Prompt
  const promptSections: string[] = [personaPrompt];

  if (customerProfile) {
    promptSections.push(`مشخصات مخاطب: ${customerProfile}`);
  }
  if (memoryContext) {
    promptSections.push(`سوابق قبلی مکالمه: ${memoryContext}`);
  }
  if (kbContext) {
    promptSections.push(`دانش مستند کسب‌وکار (تنها منبع موثق تو):\n${kbContext}`);
  }
  if (flowState && flowState !== "چت آزاد") {
    promptSections.push(`وضعیت جاری فلو: ${flowState}`);
  }
  if (variables && Object.keys(variables).length > 0) {
    promptSections.push(`متغیرها: ${JSON.stringify(variables)}`);
  }

  promptSections.push(`دستورالعمل استراتژیک این مرحله: ${strategy.guidelineForAi}`);
  promptSections.push("پاسخ نهایی را به زبان فارسی عامیانه، صمیمی، موجز و بدون هیچ‌گونه مقدمه‌چینی بنویس. فقط متن پیام ارسالی به مخاطب را تولید کن.");

  const systemPrompt = promptSections.join("\n\n");

  const aiEngine = await getAiEngine(workspaceId);

  const completion = await aiEngine.generateCompletion({
    systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 250,
  });

  let replyText = completion.text.trim();

  // Defense-in-depth: Remove any accidental military slop words
  const forbiddenRegex = /(فرمانده|امپراتوری|سرباز|مهمات|اتاق جنگ|ضدگلوله|داور بی‌رحم|قرارداد مرگ و زندگی|الکس هرموزی|راسل برانسون)/gi;
  replyText = replyText.replace(forbiddenRegex, "").trim();

  return replyText;
}
