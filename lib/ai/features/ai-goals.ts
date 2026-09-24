import { prisma } from "@/lib/db/client";
import { getAiEngine } from "../factory";
import { GoalType } from "@/lib/generated/prisma/client";

export interface EvaluateGoalParams {
  workspaceId: string;
  userId: string; // Customer IGSID
  goalType: GoalType;
  userMessage: string;
}

export interface GoalStepDecision {
  nextPrompt: string;
  progressScore: number;
  isGoalAchieved: boolean;
  actionRequired?: string;
  extractedVariables?: Record<string, string>;
}

export async function evaluateGoalStep(
  params: EvaluateGoalParams
): Promise<GoalStepDecision> {
  const { workspaceId, userId, goalType, userMessage } = params;

  // 1. Fetch or initialize active goal for user
  let goal = await prisma.aiGoal.findFirst({
    where: {
      workspaceId,
      userId,
      goalType,
      status: "IN_PROGRESS",
    },
  });

  if (!goal) {
    goal = await prisma.aiGoal.create({
      data: {
        workspaceId,
        userId,
        goalType,
        title: `Goal ${goalType} for ${userId}`,
        progressScore: 0.0,
        status: "IN_PROGRESS",
      },
    });
  }

  // 2. Resolve AI Engine
  const aiEngine = await getAiEngine(workspaceId);

  const systemPrompt = `شما هدایت‌کننده هوشمند گفتگو به سمت هدف کسب‌وکار هستید.
نوع هدف فعلی: ${goalType}.
درصد پیشرفت فعلی هدف: ${goal.progressScore}%.

وظیفه شما:
۱. تحلیل متن پیام کاربر.
۲. تشخیص این که چقدر به هدف نزدیک‌تر شدیم (عدد از ۰ تا ۱۰۰).
۳. استخراج متغیرها (مانند ایمیل، شماره، نام، نام محصول، زمان رزرو نوبت).
۴. تولید پیام بعدی جهت هدایت گفتگو به گام نهایی.

خروجی JSON:
{
  "nextPrompt": "پیام جهت ارسال به کاربر...",
  "progressScore": 75,
  "isGoalAchieved": false,
  "extractedVariables": { "email": "user@example.com" }
}`;

  const completion = await aiEngine.generateCompletion({
    systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    jsonMode: true,
  });

  let decision: GoalStepDecision = {
    nextPrompt: "لطفاً اطلاعات مورد نیاز را ارسال فرمایید.",
    progressScore: goal.progressScore,
    isGoalAchieved: false,
  };

  try {
    const parsed = JSON.parse(completion.text);
    decision = {
      nextPrompt: parsed.nextPrompt || decision.nextPrompt,
      progressScore: Math.min(100, Math.max(0, parsed.progressScore || 0)),
      isGoalAchieved: Boolean(parsed.isGoalAchieved) || parsed.progressScore >= 100,
      extractedVariables: parsed.extractedVariables || {},
    };
  } catch {
    // fallback
  }

  // Update DB Goal Progress
  await prisma.aiGoal.update({
    where: { id: goal.id },
    data: {
      progressScore: decision.progressScore,
      status: decision.isGoalAchieved ? "ACHIEVED" : "IN_PROGRESS",
    },
  });

  return decision;
}
