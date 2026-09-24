/**
 * Security Guardrails for AI Features
 * Protects against Prompt Injections, Jailbreaks, and Secret Leakage.
 */

const INJECTION_PATTERNS = [
  /ignore\s+all\s+previous\s+instructions/i,
  /ignore\s+above\s+instructions/i,
  /disregard\s+prior\s+prompts/i,
  /system\s*override/i,
  /you\s+are\s+now\s+DAN/i,
  /act\s+as\s+an\s+unfiltered\s+AI/i,
  /print\s+your\s+system\s+prompt/i,
  /reveal\s+your\s+instructions/i,
  /show\s+me\s+your\s+initial\s+prompt/i,
];

export interface GuardrailResult {
  isSafe: boolean;
  sanitizedText: string;
  injectionDetected: boolean;
  reason?: string;
}

export function evaluatePromptSafety(input: string): GuardrailResult {
  if (!input) {
    return { isSafe: true, sanitizedText: "", injectionDetected: false };
  }

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return {
        isSafe: false,
        sanitizedText: "[محتوای نامناسب شناسایی شد]",
        injectionDetected: true,
        reason: `تلاش برای پرامپت اینجکشن شناسایی شد: ${pattern.source}`,
      };
    }
  }

  // Strip excessive markdown script tags or raw HTML script injections
  const sanitizedText = input
    .replace(/<script\b[^<]*>[\s\S]*?<\/script>/gi, "")
    .trim();

  return {
    isSafe: true,
    sanitizedText,
    injectionDetected: false,
  };
}

export function sanitizeAiOutput(output: string): string {
  if (!output) return "";
  // Strip potential API keys or standard auth headers if accidentally output
  return output
    .replace(/sk-[a-zA-Z0-9]{20,}/g, "[REDACTED_API_KEY]")
    .replace(/EAAB[a-zA-Z0-9]{30,}/g, "[REDACTED_TOKEN]");
}
