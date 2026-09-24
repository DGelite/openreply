import { getAiEngine } from "../factory";

export interface GenerateFlowResult {
  flowName: string;
  goalDescription: string;
  nodes: Array<{
    id: string;
    type: "TRIGGER" | "CONDITION" | "ACTION" | "AI_STEP" | "ERROR_PATH";
    name: string;
    config: Record<string, unknown>;
  }>;
  edges: Array<{
    source: string;
    target: string;
    conditionLabel?: string;
  }>;
}

export async function generateFlowFromGoal(
  workspaceId: string,
  goalPrompt: string
): Promise<GenerateFlowResult> {
  const aiEngine = await getAiEngine(workspaceId);

  const systemPrompt = `شما طراح خودکار فلوهای اتوماسیون (AI Flow Generator) هستید.
وظیفه شما تبدیل هدف کلی کاربر (مانند "می‌خواهم لیدها را ارزیابی کرده و وقت ملاقات تنظیم کنم") به یک گراف فلو کامل با تمام نودها، شرط‌ها، متغیرها، گام‌های هوش مصنوعی و مسیرهای خطا است.

خروجی JSON:
{
  "flowName": "فلو ارزیابی لید و تنظیم جلسات",
  "goalDescription": "...",
  "nodes": [
    { "id": "node_1", "type": "TRIGGER", "name": "دریافت دایرکت", "config": { "keyword": "مشاوره" } },
    { "id": "node_2", "type": "AI_STEP", "name": "ارزیابی لید", "config": { "prompt": "دریافت ایمیل و شماره" } },
    { "id": "node_3", "type": "CONDITION", "name": "آیا لید تایید شد؟", "config": { "variable": "qualified" } },
    { "id": "node_4", "type": "ACTION", "name": "ارسال لینک رزرو نوبت", "config": { "url": "https://calendly.com" } }
  ],
  "edges": [
    { "source": "node_1", "target": "node_2" },
    { "source": "node_2", "target": "node_3" },
    { "source": "node_3", "target": "node_4", "conditionLabel": "بله" }
  ]
}`;

  const completion = await aiEngine.generateCompletion({
    systemPrompt,
    messages: [{ role: "user", content: goalPrompt }],
    jsonMode: true,
  });

  try {
    return JSON.parse(completion.text);
  } catch {
    return {
      flowName: "فلو جدید",
      goalDescription: goalPrompt,
      nodes: [],
      edges: [],
    };
  }
}
