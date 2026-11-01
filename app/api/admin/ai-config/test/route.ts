import { NextResponse } from "next/server";
import { getAiEngine } from "@/lib/ai/factory";
import { getCurrentWorkspaceContext, canManageWorkspace } from "@/lib/workspace-access";

export async function POST(req: Request) {
  try {
    const context = await getCurrentWorkspaceContext();
    if (!context?.workspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canManageWorkspace(context.role)) {
      return NextResponse.json(
        { error: "فقط مدیران اجازه تست تنظیمات هوش مصنوعی را دارند." },
        { status: 403 }
      );
    }

    const workspaceId = context.workspaceId;

    // Attempt to get the AI engine and perform a simple prompt test
    const aiEngine = await getAiEngine(workspaceId);

    const completion = await aiEngine.generateCompletion({
      systemPrompt: "You are an API testing bot.",
      messages: [{ role: "user", content: "Reply with the word 'SUCCESS' if you receive this." }],
      temperature: 0.1,
    });

    if (completion && completion.text) {
      return NextResponse.json({ 
        success: true, 
        message: "ارتباط با هوش مصنوعی با موفقیت برقرار شد.",
        provider: completion.provider,
        model: completion.model,
        latency: completion.latencyMs
      });
    } else {
      return NextResponse.json({ success: false, error: "No response from AI." }, { status: 500 });
    }
  } catch (error: any) {
    console.error("AI Test API Error:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || "خطا در برقراری ارتباط با سرویس‌دهنده AI."
    }, { status: 200 });
  }
}
