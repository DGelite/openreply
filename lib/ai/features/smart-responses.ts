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

  // 1. Customer Profile & Lead
  const lead = await prisma.lead.findFirst({
    where: { workspaceId, userId },
  });

  // 2. Conversation Memory
  const memories = await prisma.aiConversationMemory.findMany({
    where: { workspaceId, userId },
    take: 5,
  });

  // 3. RAG Knowledge Search
  const ragDocs = await queryKnowledgeBase(workspaceId, userMessage, 2);

  const customerProfile = lead
    ? `نام: ${lead.name || lead.username || "نامشخص"}, ایمیل: ${lead.email || "ندارد"}, شماره: ${lead.phone || "ندارد"}`
    : "پروفایل مشتری یافت نشد.";

  const memoryContext = memories.map((m) => `${m.memoryKey}: ${m.memoryValue}`).join(", ");
  const kbContext = ragDocs.map((d) => d.content).join("\n");

  const aiEngine = await getAiEngine(workspaceId);

  const systemPrompt = `شما موتور پاسخ‌دهی فوق هوشمند (Smart Responses Engine) هستید.
اطلاعات در دسترس شما:
پروفایل مشتری: ${customerProfile}
حافظه مکالمات: ${memoryContext || "ندارد"}
دانش کسب‌وکار: ${kbContext || "ندارد"}
وضعیت فعلی فلو: ${flowState || "چت آزاد"}
متغیرها: ${JSON.stringify(variables || {})}

پاسخ را کاملاً طبیعی، شخصی‌سازی شده، هدفمند و مرتبط با سوابق کاربر بنویس. فقط متن پاسخ نهایی را خروجی بده.`;

  const completion = await aiEngine.generateCompletion({
    systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  return completion.text.trim();
}
