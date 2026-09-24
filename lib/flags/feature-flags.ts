import { prisma } from "@/lib/db/client";

export type FeatureKey =
  | "SPIKE_BUFFER"
  | "HUMAN_HANDOVER"
  | "SMART_DELAY"
  | "AI_COMPRESSION"
  | "DEDUP"
  | "DLQ"
  | "SMS_FALLBACK"
  | "FUNNEL"
  | "GLASS_UI";

export interface FeatureConfigMap {
  SPIKE_BUFFER: { maxBatchSize: number; flushIntervalMs: number };
  HUMAN_HANDOVER: { keywords: string[]; autoPauseHours: number };
  SMART_DELAY: { minDelaySec: number; maxDelaySec: number; warmUpLimit: number };
  AI_COMPRESSION: { maxTurns: number; summarizeThreshold: number };
  DEDUP: { ttlSeconds: number };
  DLQ: { maxAttempts: number; autoRetryDelayMin: number };
  SMS_FALLBACK: { provider: string; windowHours: number };
  FUNNEL: { trackingEnabled: boolean };
  GLASS_UI: { enableAnimations: boolean; theme: string };
}

export const DEFAULT_FEATURE_CONFIGS: Record<FeatureKey, { isEnabled: boolean; config: any }> = {
  SPIKE_BUFFER: { isEnabled: true, config: { maxBatchSize: 50, flushIntervalMs: 2000 } },
  HUMAN_HANDOVER: { isEnabled: true, config: { keywords: ["انسان", "پشتیبان", "پشتیبانی", "ادمین", "اپراتور", "صحبت با ادمین"], autoPauseHours: 24 } },
  SMART_DELAY: { isEnabled: true, config: { minDelaySec: 3, maxDelaySec: 10, warmUpLimit: 100 } },
  AI_COMPRESSION: { isEnabled: true, config: { maxTurns: 5, summarizeThreshold: 8 } },
  DEDUP: { isEnabled: true, config: { ttlSeconds: 86400 } },
  DLQ: { isEnabled: true, config: { maxAttempts: 3, autoRetryDelayMin: 15 } },
  SMS_FALLBACK: { isEnabled: true, config: { provider: "KAVENEGAR", windowHours: 24 } },
  FUNNEL: { isEnabled: true, config: { trackingEnabled: true } },
  GLASS_UI: { isEnabled: true, config: { enableAnimations: true, theme: "dark-glass" } },
};

export async function isFeatureEnabled(featureKey: FeatureKey, workspaceId?: string): Promise<boolean> {
  try {
    const flag = await prisma.systemFeatureFlag.findFirst({
      where: {
        featureKey,
        OR: [{ workspaceId: workspaceId || null }, { workspaceId: null }],
      },
      orderBy: { workspaceId: "desc" },
    });
    return flag ? flag.isEnabled : DEFAULT_FEATURE_CONFIGS[featureKey]?.isEnabled ?? true;
  } catch (error) {
    console.error(`Error checking feature flag ${featureKey}:`, error);
    return DEFAULT_FEATURE_CONFIGS[featureKey]?.isEnabled ?? true;
  }
}

export async function getFeatureConfig<K extends FeatureKey>(
  featureKey: K,
  workspaceId?: string
): Promise<FeatureConfigMap[K]> {
  try {
    const flag = await prisma.systemFeatureFlag.findFirst({
      where: {
        featureKey,
        OR: [{ workspaceId: workspaceId || null }, { workspaceId: null }],
      },
      orderBy: { workspaceId: "desc" },
    });
    if (flag && flag.config && typeof flag.config === "object") {
      return { ...DEFAULT_FEATURE_CONFIGS[featureKey].config, ...(flag.config as any) };
    }
  } catch (error) {
    console.error(`Error reading config for feature ${featureKey}:`, error);
  }
  return DEFAULT_FEATURE_CONFIGS[featureKey].config;
}

export async function setFeatureFlag(
  featureKey: FeatureKey,
  isEnabled: boolean,
  config?: any,
  workspaceId?: string
) {
  const existing = await prisma.systemFeatureFlag.findFirst({
    where: {
      featureKey,
      workspaceId: workspaceId || null,
    },
  });

  if (existing) {
    return await prisma.systemFeatureFlag.update({
      where: { id: existing.id },
      data: {
        isEnabled,
        ...(config ? { config } : {}),
      },
    });
  }

  return await prisma.systemFeatureFlag.create({
    data: {
      workspaceId: workspaceId || null,
      featureKey,
      isEnabled,
      config: config || DEFAULT_FEATURE_CONFIGS[featureKey].config,
    },
  });
}
