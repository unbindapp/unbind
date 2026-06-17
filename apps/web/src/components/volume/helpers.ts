import { TVolumeUsageLevel } from "@/components/volume/types";
import { appLocale } from "@/lib/constants";

export function getVolumeUsageLevel(percentage: number | null | undefined): TVolumeUsageLevel {
  if (percentage === null || percentage === undefined) {
    return "low";
  }
  if (percentage >= 85) {
    return "high";
  }
  return "low";
}

export function percentageFormatter(number: number) {
  return parseFloat(number.toPrecision(3)).toLocaleString(appLocale, {
    maximumFractionDigits: 2,
  });
}
