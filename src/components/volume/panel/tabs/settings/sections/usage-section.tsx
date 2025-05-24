import ErrorLine from "@/components/error-line";
import { getVolumeUsageLevel, percentageFormatter } from "@/components/volume/helpers";
import { TVolumeUsageLevel } from "@/components/volume/types";
import { useVolume } from "@/components/volume/volume-provider";
import { formatGB } from "@/lib/helpers/format-gb";
import { useMemo } from "react";

export default function UsageSection() {
  const {
    query: { data, isPending: isPendingVolume, error },
  } = useVolume();

  const usedGBString = useMemo(() => {
    if (data && data.volume.used_gb !== undefined) return formatGB(data.volume.used_gb);
    if (data && data.volume.used_gb === undefined) return "Unknown";
    if (isPendingVolume) return "1GB";
    if (error) return "Error";
    return "Unknown";
  }, [data, isPendingVolume, error]);

  const sizeGBString = useMemo(() => {
    if (data && data.volume.size_gb !== undefined) return formatGB(data.volume.size_gb);
    if (data && data.volume.size_gb === undefined) return "Unknown";
    if (isPendingVolume) return "10GB";
    if (error) return "Error";
    return "Unknown";
  }, [data, isPendingVolume, error]);

  const usagePercentage = useMemo(() => {
    if (data && data.volume.size_gb !== undefined && data.volume.used_gb !== undefined) {
      return Math.min(Math.max(0, (data.volume.used_gb / data.volume.size_gb) * 100), 100);
    }
    if (data && data.volume.size_gb === undefined) return null;
    if (data && data.volume.used_gb === undefined) return null;
    if (isPendingVolume) return undefined;
    if (error) return undefined;
    return 0;
  }, [data, isPendingVolume, error]);

  const percentageString = useMemo(() => {
    if (usagePercentage !== undefined && usagePercentage !== null) {
      return `${percentageFormatter(usagePercentage)}%`;
    }
    if (isPendingVolume) return "10%";
    if (error) return "Error";
    return "Unknown";
  }, [usagePercentage, isPendingVolume, error]);

  const usageLevel: TVolumeUsageLevel = useMemo(() => {
    return getVolumeUsageLevel(usagePercentage);
  }, [usagePercentage]);

  const isPending = isPendingVolume || (data && usagePercentage === undefined);

  return (
    <div
      data-pending={isPending ? true : undefined}
      data-error={!data && !isPending && error ? true : undefined}
      data-usage={usageLevel}
      className="group/section flex w-full flex-col gap-2.5 leading-tight font-medium md:max-w-xl"
    >
      <div className="text-muted-foreground flex w-full items-end justify-between px-1.5">
        <p className="group-data-pending/section:animate-skeleton group-data-pending/section:bg-foreground max-w-1/2 truncate pr-2 font-medium group-data-pending/section:rounded-md group-data-pending/section:text-transparent">
          Used:{" "}
          <span className="text-foreground group-data-error/section:text-destructive font-semibold group-data-pending/section:text-transparent">
            {usedGBString}
          </span>
        </p>
        <p className="group-data-pending/section:animate-skeleton group-data-pending/section:bg-foreground max-w-1/2 truncate pl-2 text-right font-medium group-data-pending/section:rounded-md group-data-pending/section:text-transparent">
          Total:{" "}
          <span className="text-foreground group-data-error/section:text-destructive font-semibold group-data-pending/section:text-transparent">
            {sizeGBString}
          </span>
        </p>
      </div>
      <div className="relative flex w-full items-center justify-start overflow-hidden rounded-lg border px-2.5 py-2">
        {usagePercentage !== undefined && usagePercentage !== null && (
          <div className="absolute top-0 left-0 h-full w-full">
            <div
              style={{
                transform: `scaleX(${Math.ceil(usagePercentage)}%)`,
              }}
              className="bg-foreground/8 group-data-[usage=high]/section:bg-warning/8 h-full w-full origin-left"
            />
          </div>
        )}
        <p className="group-data-[usage=high]/section:text-warning group-data-error/section:text-destructive group-data-pending/section:animate-skeleton group-data-pending/section:bg-foreground relative max-w-full min-w-0 truncate font-semibold group-data-pending/section:rounded-md group-data-pending/section:text-transparent">
          {percentageString}
        </p>
      </div>
      {!data && !isPendingVolume && error && <ErrorLine message={error.message} />}
    </div>
  );
}
