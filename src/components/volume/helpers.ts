import { TVolumeUsageLevel } from "@/components/volume/types";

export function getVolumeUsageLevel(percentage: number | null | undefined): TVolumeUsageLevel {
  if (percentage === null || percentage === undefined) {
    return "low";
  }
  if (percentage >= 85) {
    return "high";
  }
  return "low";
}
