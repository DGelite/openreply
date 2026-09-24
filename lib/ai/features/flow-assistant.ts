import { getAiEngine } from "../factory";

export interface FlowAssistantParams {
  workspaceId: string;
  prompt: string;
  existingFlow?: Record<string, unknown>;
  task: "GENERATE" | "OPTIMIZE" | "DETECT_ERRORS";
}

export interface FlowAssistantResult {
  explanation: string;
  nodes?: Array<{ id: string; type: string; data: Record<string, unknown> }>;
  suggestions?: string[];
  detectedErrors?: string[];
}

export async function runFlowAssistant(
  params: FlowAssistantParams
): Promise<FlowAssistantResult> {
  const { workspaceId, prompt, existingFlow, task } = params;

  const aiEngine = await getAiEngine(workspaceId);

  const systemPrompt = `شما دستیار ارشد طراحی اتوماسیون (Flow Builder Assistant) هستید.
وظیفه شما: ${
    task === "GENERATE"
      ? "ساخت ساختار کامل نودهای فلو از روی توضیحات ساده کاربر"
      : task === "OPTIMIZE"
      ? "بهینه‌سازی فلو و کاهش گام‌های غیرضروری"
      : "شناسایی خطاهای منطقی، بن‌بست‌ها و فلوهای بدون پاسخ"
  }.

پاسخ را به صورت JSON ساختاریافته ارائه بده:
{
  "explanation": "توضیح کامل فلو طراحی شده یا بهینه‌سازی شده...",
  "nodes": [
    { "id": "node_1", "type": "trigger", "data": { "keyword": "قیمت" } },
    { "id": "node_2", "type": "ai_step", "data": { "action": "qualify_lead" } }
  ],
  "suggestions": ["پیشنهاد ۱", "پیشنهاد ۲"],
  "detectedErrors": []
}`;

  const completion = await aiEngine.generateCompletion({
    systemPrompt,
    messages: [
      {
        role: "user",
        content: `درخواست کاربر: "${prompt}"\nفلو فعلی: ${JSON.stringify(existingFlow || {})}`,
      },
    ],
    jsonMode: true,
  });

  try {
    return JSON.parse(completion.text);
  } catch {
    return {
      explanation: completion.text,
      nodes: [],
      suggestions: [],
      detectedErrors: [],
    };
  }
}
