import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import {
  getVolumeDisplayName,
  getVolumeUsageLevel,
  percentageFormatter,
} from "@/components/volume/helpers";
import VolumePanel from "@/components/volume/panel/volume-panel";
import { TVolumeUsageLevel } from "@/components/volume/types";
import { TVolumeShallow } from "@/lib/queries/services";
import { HardDriveIcon, HourglassIcon } from "lucide-react";
import { useMemo } from "react";

type TProps = {
  volume: TVolumeShallow;
  className?: string;
};

export default function VolumeLine({ volume, className }: TProps) {
  const usagePercentage = useMemo(() => {
    if (volume.used_gb === undefined || !volume.capacity_gb) return undefined;
    return Math.min(Math.max(0, (volume.used_gb / volume.capacity_gb) * 100), 100);
  }, [volume]);

  const usageLevel: TVolumeUsageLevel = useMemo(() => {
    return getVolumeUsageLevel(usagePercentage);
  }, [usagePercentage]);

  return (
    <VolumePanel volume={volume}>
      <Button
        variant={"card"}
        data-usage={usageLevel}
        key={volume.id}
        className={cn(
          "group/line bg-background relative w-full overflow-hidden rounded-none border px-0 py-2",
          className,
        )}
      >
        {usagePercentage !== undefined && (
          <div className="absolute top-0 left-0 h-full w-full">
            <div
              style={{
                transform: `scaleX(${Math.ceil(usagePercentage)}%)`,
              }}
              className="bg-foreground/6 group-data-[usage=high]/line:bg-warning/8 group-data-[usage=critical]/line:bg-destructive/8 h-full w-full origin-left"
            />
          </div>
        )}
        <div className="text-muted-foreground group-data-[usage=high]/line:text-warning group-data-[usage=critical]/line:text-destructive flex w-full items-center justify-between gap-4 px-4">
          <div className="relative flex w-full items-center justify-between gap-8 leading-tight font-medium">
            <div
              data-truncate={usagePercentage === undefined || undefined}
              className="group/line flex min-w-0 shrink items-center gap-1.5"
            >
              {volume.is_attaching || volume.is_pending_resize || usagePercentage === undefined ? (
                <HourglassIcon className="animate-hourglass size-3 min-w-0 shrink-0" />
              ) : (
                <HardDriveIcon className="size-3.5 min-w-0 shrink-0" />
              )}
              <p className="group-data-truncate/line:min-w-0 group-data-truncate/line:shrink group-data-truncate/line:truncate">
                {volume.is_attaching
                  ? "Attaching"
                  : volume.is_pending_resize
                    ? "Expanding"
                    : usagePercentage !== undefined
                      ? `${percentageFormatter(usagePercentage)}%`
                      : "Measuring"}
              </p>
            </div>
            <p className="max-w-[40%] min-w-0 shrink truncate text-right">
              {getVolumeDisplayName(volume)}
            </p>
          </div>
        </div>
      </Button>
    </VolumePanel>
  );
}
