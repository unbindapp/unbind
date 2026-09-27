import type { RegistryCacheStats } from "@/lib/server/client.gen";

const bytesPerGB = 1024 * 1024 * 1024;
const almostFullPercentage = 90;

export type TRegistryUsageLevel = "low" | "high" | "critical";

export type TRegistryWarning = {
  level: Exclude<TRegistryUsageLevel, "low">;
  title: string;
  description: string;
};

export function getRegistryUsedGB(stats: RegistryCacheStats): number {
  return stats.used_bytes / bytesPerGB;
}

export function getRegistryUsagePercentage(stats: RegistryCacheStats): number | undefined {
  if (!stats.pvc_capacity_gb) return undefined;
  return Math.min(Math.max(0, (getRegistryUsedGB(stats) / stats.pvc_capacity_gb) * 100), 100);
}

export function getRegistryThresholdPercentage(stats: RegistryCacheStats): number | undefined {
  if (!stats.pvc_capacity_gb || !stats.cleanup_threshold_gb) return undefined;
  return Math.min((stats.cleanup_threshold_gb / stats.pvc_capacity_gb) * 100, 100);
}

// Usage sits under the threshold until cleanup runs, so only being stuck over it or near capacity is a problem
export function getRegistryWarning(stats: RegistryCacheStats): TRegistryWarning | null {
  if (!stats.managed) return null;

  const run = stats.last_cleanup;
  const percentage = getRegistryUsagePercentage(stats);

  if (percentage !== undefined && percentage >= almostFullPercentage) {
    return {
      level: "critical",
      title: "Registry is almost full",
      description: "Builds fail once it is full. Clean it up or grow it.",
    };
  }

  if (run?.status === "succeeded" && run.result?.outcome === "over_threshold") {
    return {
      level: "critical",
      title: "Registry cleanup can't free enough space",
      description: "Every image left is deployed or recent. Grow the registry to keep building.",
    };
  }

  if (run?.status === "failed") {
    return {
      level: "high",
      title: "Registry cleanup failed",
      description: run.result?.error || "The last cleanup didn't finish.",
    };
  }

  return null;
}

export function getRegistryUsageLevel(stats: RegistryCacheStats): TRegistryUsageLevel {
  const warning = getRegistryWarning(stats);
  if (warning?.level === "critical") return "critical";
  if (stats.cleanup_threshold_gb && getRegistryUsedGB(stats) >= stats.cleanup_threshold_gb) {
    return "high";
  }
  return "low";
}
