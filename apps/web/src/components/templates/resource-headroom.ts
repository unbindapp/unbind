import type { TServer } from "@/lib/queries/servers";
import type { TemplateResourceRecommendations } from "@/lib/server/client.gen";

// Available / minimum recommended ratio below which each level kicks in
export const templateHeadroomThresholds = {
  destructive: 1,
  warning: 1.5,
};

export type TTemplateHeadroomLevel = "normal" | "warning" | "destructive";

export type TTemplateHeadroom = {
  level: TTemplateHeadroomLevel;
  recommendedCpuMillicores: number;
  recommendedMemoryMegabytes: number;
  availableCpuMillicores: number;
  availableMemoryMegabytes: number;
};

export function getTemplateHeadroom(
  servers: TServer[],
  recommendations: TemplateResourceRecommendations,
): TTemplateHeadroom {
  const recommendedCpuMillicores = Math.round(recommendations.minimum_recommended_cpu * 1000);
  const recommendedMemoryMegabytes = Math.round(recommendations.minimum_recommended_ram_gb * 1024);

  let availableCpuMillicores = 0;
  let availableMemoryMegabytes = 0;
  for (const server of servers) {
    if (!server.ready || server.unschedulable) continue;
    availableCpuMillicores += Math.max(
      0,
      server.cpu_allocatable_millicores - server.cpu_requested_millicores,
    );
    availableMemoryMegabytes += Math.max(
      0,
      server.memory_allocatable_megabytes - server.memory_requested_megabytes,
    );
  }

  const ratio = Math.min(
    ratioOf(availableCpuMillicores, recommendedCpuMillicores),
    ratioOf(availableMemoryMegabytes, recommendedMemoryMegabytes),
  );

  return {
    level: levelOf(ratio),
    recommendedCpuMillicores,
    recommendedMemoryMegabytes,
    availableCpuMillicores,
    availableMemoryMegabytes,
  };
}

function ratioOf(available: number, recommended: number): number {
  if (recommended <= 0) return Infinity;
  return available / recommended;
}

function levelOf(ratio: number): TTemplateHeadroomLevel {
  if (ratio < templateHeadroomThresholds.destructive) return "destructive";
  if (ratio < templateHeadroomThresholds.warning) return "warning";
  return "normal";
}
