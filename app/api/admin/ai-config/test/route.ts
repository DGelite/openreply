import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceContext, canManageWorkspace } from "@/lib/workspace-access";
import { prisma } from "@/lib/db/client";
import { safeDecryptToken } from "@/lib/meta/oauth";
import { GeminiProvider } from "@/lib/ai/providers/gemini-provider";
import { OpenAIProvider } from "@/lib/ai/providers/openai-provider";
import { BoxApiAiProvider } from "@/lib/ai/providers/boxapi-ai-provider";
import { AiProvider } from "@/lib/ai/types";

export const dynamic = "force-dynamic";

function sanitizeError(errorText: string, keyToHide?: string): string {
  let clean = errorText;
  if (keyToHide && keyToHide.length > 5) {
    clean = clean.replaceAll(keyToHide, "••••••••");
  }
  return clean.replace(/key=[a-zA-Z0-9_\-]+/gi, "key=••••••••")
              .replace(/Bearer\s+[a-zA-Z0-9_\-]+/gi, "Bearer ••••••••");
}

export async function POST(req: NextRequest) {
  try {
    const context = await getCurrentWorkspaceContext();
    if (!context?.workspaceId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!canManageWorkspace(context.role)) {
      return NextResponse.json(
        { success: false, error: "فقط مدیران اجازه تست تنظیمات هوش مصنوعی را دارند." },
        { status: 403 }
      );
    }

    const workspaceId = context.workspaceId;
    const body = await req.json().catch(() => ({}));
    const { provider: targetProvider, apiKey: directKey, model: targetModel, baseUrl: directBaseUrl } = body;

    const config = await prisma.aiConfig.findUnique({
      where: { workspaceId },
    });

    const activeProvider = (targetProvider || config?.provider || "GEMINI").toUpperCase();

    let engine: AiProvider;
    let usedKey = "";

    switch (activeProvider) {
      case "OPENAI": {
        usedKey = directKey ||
          (config?.openAiApiKeyEncrypted ? safeDecryptToken(config.openAiApiKeyEncrypted) : null) ||
          (config?.apiKeyEncrypted ? safeDecryptToken(config.apiKeyEncrypted) : null) ||
          process.env.OPENAI_API_KEY || "";

        if (!usedKey) {
          return NextResponse.json({
            success: false,
            error: "کلید API برای OpenAI تعریف نشده است. لطفاً ابتدا کلید را وارد کنید.",
            provider: "OPENAI",
          });
        }

        const model = targetModel || config?.openAiModel || "gpt-4o-mini";
        const baseUrl = directBaseUrl || config?.baseUrl || "https://api.openai.com/v1";
        engine = new OpenAIProvider(usedKey, model, baseUrl, "OPENAI");
        break;
      }

      case "BOXAPI": {
        usedKey = directKey ||
          (config?.boxApiAiKeyEncrypted ? safeDecryptToken(config.boxApiAiKeyEncrypted) : null) ||
          (config?.apiKeyEncrypted ? safeDecryptToken(config.apiKeyEncrypted) : null) ||
          process.env.BOXAPI_DATA_TOKEN ||
          process.env.BOXAPI_API_KEY || "";

        if (!usedKey) {
          return NextResponse.json({
            success: false,
            error: "کلید API برای BoxAPI AI تعریف نشده است.",
            provider: "BOXAPI",
          });
        }

        const model = targetModel || config?.boxApiAiModel || "gpt-4o-mini";
        const baseUrl = directBaseUrl || config?.boxApiAiBaseUrl || "https://boxapi.ir/api/v1";
        engine = new BoxApiAiProvider(usedKey, model, baseUrl);
        break;
      }

      case "GEMINI":
      default: {
        usedKey = directKey ||
          (config?.geminiApiKeyEncrypted ? safeDecryptToken(config.geminiApiKeyEncrypted) : null) ||
          (config?.apiKeyEncrypted ? safeDecryptToken(config.apiKeyEncrypted) : null) ||
          process.env.GEMINI_API_KEY || "";

        if (!usedKey) {
          return NextResponse.json({
            success: false,
            error: "کلید API برای Google Gemini تعریف نشده است. لطفاً کلید API را وارد کنید.",
            provider: "GEMINI",
          });
        }

        const model = targetModel || config?.geminiModel || "gemini-2.5-flash";
        const baseUrl = directBaseUrl || config?.baseUrl || undefined;
        engine = new GeminiProvider(usedKey, model, baseUrl);
        break;
      }
    }

    const testPrompt = "Ping! Reply with SUCCESS.";
    const completion = await engine.generateCompletion({
      systemPrompt: "You are an API testing probe. Reply with the single word SUCCESS.",
      messages: [{ role: "user", content: testPrompt }],
      temperature: 0.1,
      maxTokens: 50,
    });

    const isSuccess = Boolean(completion && completion.text);
    const testResultData = {
      success: isSuccess,
      provider: activeProvider,
      model: completion.model || engine.model,
      latencyMs: completion.latencyMs,
      timestamp: new Date().toISOString(),
      verifiedDirect: activeProvider !== "BOXAPI",
    };

    // Update last test status in DB if config exists
    if (config) {
      const existingStatus = (config.lastTestStatus as Record<string, any>) || {};
      existingStatus[activeProvider] = testResultData;
      await prisma.aiConfig.update({
        where: { workspaceId },
        data: { lastTestStatus: existingStatus },
      }).catch(() => {});
    }

    const providerFaNames: Record<string, string> = {
      GEMINI: "Google Gemini (اتصال مستقیم به API رسمی گوگل)",
      OPENAI: "OpenAI (اتصال مستقیم به API رسمی OpenAI)",
      BOXAPI: "BoxAPI AI (سرویس پروکسی هوش مصنوعی BoxAPI)",
    };

    return NextResponse.json({
      success: true,
      message: `✅ تست اتصال موفقیت‌آمیز بود! (${providerFaNames[activeProvider] || activeProvider} - مدل: ${completion.model} - تاخیر: ${completion.latencyMs}ms)`,
      provider: activeProvider,
      model: completion.model,
      latencyMs: completion.latencyMs,
      sampleOutput: completion.text.slice(0, 50),
    });
  } catch (error: any) {
    console.error("[AI Test Connection Error]:", error);
    const rawError = error?.message || "خطای ناشناخته در برقراری ارتباط با سرور هوش مصنوعی";
    const cleanError = sanitizeError(rawError);

    return NextResponse.json(
      {
        success: false,
        error: `خطا در تست اتصال: ${cleanError}`,
      },
      { status: 200 }
    );
  }
}
