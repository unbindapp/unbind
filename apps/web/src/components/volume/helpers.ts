import { TVolumeUsageLevel } from "@/components/volume/types";
import { TVolumeShallow } from "@/lib/queries/services";
import { appLocale } from "@/lib/constants";

export function getVolumeDisplayName(volume: Pick<TVolumeShallow, "name" | "id">): string {
  return volume.name || volume.id;
}

export function getVolumeUsageLevel(percentage: number | null | undefined): TVolumeUsageLevel {
  if (percentage === null || percentage === undefined) {
    return "low";
  }
  if (percentage >= 85) {
    return "critical";
  }
  if (percentage >= 75) {
    return "high";
  }
  return "low";
}

export function percentageFormatter(number: number) {
  return parseFloat(number.toPrecision(3)).toLocaleString(appLocale, {
    maximumFractionDigits: 2,
  });
}
