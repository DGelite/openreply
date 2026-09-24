import { getAiEngine } from "../factory";
import { queryKnowledgeBase } from "./knowledge-base";

export interface AiStepInput {
  workspaceId: string;
  userMessage: string;
  flowVariables: Record<string, unknown>;
  conversationContext: string[];
  customInstruction?: string;
}

export interface AiStepOutput {
  decision: string;
  outputVariables: Record<string, unknown>;
  responseMessage?: string;
  nextBranch: string;
}

export async function executeAiFlowStep(
  input: AiStepInput
): Promise<AiStepOutput> {
  const { workspaceId, userMessage, flowVariables, conversationContext, customInstruction } = input;

  // Query Knowledge Base for Context
  const ragDocs = await queryKnowledgeBase(workspaceId, userMessage, 2);
  const kbContext = ragDocs.map((d) => `[${d.documentTitle}]: ${d.content}`).join("\n");

  const aiEngine = await getAiEngine(workspaceId);

  const systemPrompt = `شما گام هوشمند (AI Step) در فلو اتوماسیون هستید.
وظیفه شما بررسی وضعیت گفتگو، متغیرهای فلو و پایگاه دانش کسب‌وکار و اتخاذ تصمیم بعدی است.

دستورالعمل خاص این گام: ${customInstruction || "کاربر را راهنمایی کرده و گام بعدی را مشخص کن."}

دانش کسب‌وکار مربوطه:
${kbContext || "هیچ مستند خاصی یافت نشد."}

متغیرهای فعلی فلو:
${JSON.stringify(flowVariables, null, 2)}

خروجی JSON حتماً باید این شکل را داشته باشد:
{
  "decision": "توضیح مختصر تصمیم...",
  "outputVariables": { "userIntent": "SALES", "qualified": true },
  "responseMessage": "متن پاسخ به کاربر...",
  "nextBranch": "success" // یا "fallback" یا "human_agent"
}`;

  const completion = await aiEngine.generateCompletion({
    systemPrompt,
    messages: [
      ...conversationContext.map((c) => ({ role: "user" as const, content: c })),
      { role: "user", content: userMessage },
    ],
    jsonMode: true,
  });

  try {
    const parsed = JSON.parse(completion.text);
    return {
      decision: parsed.decision || "ادامه فلو",
      outputVariables: parsed.outputVariables || {},
      responseMessage: parsed.responseMessage,
      nextBranch: parsed.nextBranch || "success",
    };
  } catch {
    return {
      decision: "خطا در خروجی AI",
      outputVariables: {},
      responseMessage: undefined,
      nextBranch: "fallback",
    };
  }
}
