import { getFeatureConfig, isFeatureEnabled } from "@/lib/flags/feature-flags";

export async function calculateSmartDelayMs(workspaceId?: string): Promise<number> {
  const enabled = await isFeatureEnabled("SMART_DELAY", workspaceId);
  if (!enabled) {
    return 0;
  }

  const config = await getFeatureConfig("SMART_DELAY", workspaceId);
  const minMs = config.minDelaySec * 1000;
  const maxMs = config.maxDelaySec * 1000;

  // Add random jitter
  const randomJitter = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return randomJitter;
}

export async function applySmartDelay(workspaceId?: string): Promise<void> {
  const delayMs = await calculateSmartDelayMs(workspaceId);
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}
