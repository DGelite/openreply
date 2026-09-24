import { prisma } from "@/lib/db/client";
import { getAiEngine } from "../factory";
import { evaluatePromptSafety } from "../security/guardrails";
import { isAiActive } from "../utils";

export interface GenerateCommentReplyParams {
  workspaceId: string;
  commentId: string;
  commentText: string;
  commenterUsername?: string;
}

export interface GenerateCommentReplyResult {
  replyText: string;
  isSpam: boolean;
  confidenceScore: number;
  requiresManualApproval: boolean;
  shouldSkip: boolean;
}

export async function processAiComment(
  params: GenerateCommentReplyParams
): Promise<GenerateCommentReplyResult> {
  const { workspaceId, commentId, commentText, commenterUsername } = params;

  // 1. Safety Check & Spam Detection
  const safety = evaluatePromptSafety(commentText);
  if (!safety.isSafe) {
    return {
      replyText: "",
      isSpam: true,
      confidenceScore: 0.0,
      requiresManualApproval: false,
      shouldSkip: true,
    };
  }

  // 2. Fetch AI Config for Workspace
  const config = await prisma.aiConfig.findUnique({
    where: { workspaceId },
  });

  const confidenceThreshold = config?.confidenceThreshold ?? 0.75;
  const manualApprovalMode = config?.manualApprovalMode ?? false;

  if (config && !isAiActive(config as any)) {
    return {
      replyText: "",
      isSpam: false,
      confidenceScore: 1.0,
      requiresManualApproval: false,
      shouldSkip: true, // Skip AI comment response when outside active hours
    };
  }

  // 3. Resolve AI Engine
  const aiEngine = await getAiEngine(workspaceId);

  const systemPrompt = `شما مسئول پاسخگویی خودکار به کامنت‌های پست‌های اینستاگرام هستید.
وظایف:
۱. تحلیل متن کامنت از نظر اسپم، فحاشی یا بی‌ربط بودن.
۲. ساخت پاسخ کامپکت، کوتاه (حداکثر ۱۰ الی ۱۵ کلمه) و صمیمی همراه با ایموجی.
۳. در صورتی که کامنت اسپم یا کاملاً بی‌معنی بود، مقدار isSpam را true بگذارید.

خروجی شما باید یک JSON به فرمت زیر باشد:
{
  "replyText": "پاسخ کامنت...",
  "isSpam": false,
  "confidenceScore": 0.95
}`;

  const completion = await aiEngine.generateCompletion({
    systemPrompt,
    messages: [
      {
        role: "user",
        content: `کامنت کاربر ${commenterUsername || ""}: "${commentText}"`,
      },
    ],
    jsonMode: true,
  });

  let parsed = {
    replyText: "مرسی بابت کامنت قشنگتون! ❤️",
    isSpam: false,
    confidenceScore: 0.9,
  };

  try {
    parsed = JSON.parse(completion.text);
  } catch {
    // fallback if JSON parse fails
  }

  const requiresApproval =
    manualApprovalMode || parsed.confidenceScore < confidenceThreshold;

  // Fire-and-forget audit log — never block the main response path
  prisma.aiAuditLog
    .create({
      data: {
        workspaceId,
        feature: "COMMENTS",
        provider: completion.provider,
        model: completion.model,
        promptTokens: completion.promptTokens,
        completionTokens: completion.completionTokens,
        latencyMs: completion.latencyMs,
        confidenceScore: parsed.confidenceScore,
      },
    })
    .catch((err) => console.error("[AI Comments] Audit log failed:", err));

  return {
    replyText: parsed.replyText,
    isSpam: parsed.isSpam,
    confidenceScore: parsed.confidenceScore,
    requiresManualApproval: requiresApproval,
    shouldSkip: parsed.isSpam,
  };
}
