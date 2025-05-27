import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { getVolumeUsageLevel, percentageFormatter } from "@/components/volume/helpers";
import VolumePanel from "@/components/volume/panel/volume-panel";
import { TVolumeUsageLevel } from "@/components/volume/types";
import { TVolumeShallow } from "@/server/trpc/api/services/types";
import { HardDriveIcon, HourglassIcon } from "lucide-react";
import { useMemo } from "react";

type TProps = {
  volume: TVolumeShallow;
  teamId: string;
  projectId: string;
  environmentId: string;
  index: number;
  className?: string;
};

export default function VolumeLine({
  volume,
  teamId,
  projectId,
  environmentId,
  index,
  className,
}: TProps) {
  const usagePercentage = useMemo(() => {
    if (!volume.used_gb || !volume.capacity_gb) return undefined;
    return Math.min(Math.max(0, (volume.used_gb / volume.capacity_gb) * 100), 100);
  }, [volume]);

  const usageLevel: TVolumeUsageLevel = useMemo(() => {
    return getVolumeUsageLevel(usagePercentage);
  }, [usagePercentage]);

  return (
    <VolumePanel
      volume={volume}
      teamId={teamId}
      projectId={projectId}
      environmentId={environmentId}
    >
      <Button
        variant={"ghost"}
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
              className="bg-foreground/6 group-data-[usage=high]/line:bg-warning/8 h-full w-full origin-left"
            />
          </div>
        )}
        <div className="text-muted-foreground group-data-[usage=high]/line:text-warning flex w-full items-center justify-between gap-4 px-4">
          <div className="relative flex w-full items-center justify-between gap-4 leading-tight font-medium">
            <div
              data-truncate={usagePercentage === undefined ? true : undefined}
              className="group/line flex min-w-0 shrink items-center gap-1.5"
            >
              {volume.is_pending_resize ? (
                <HourglassIcon className="animate-hourglass size-3.5 min-w-0 shrink-0 scale-90" />
              ) : (
                <HardDriveIcon className="size-3.5 min-w-0 shrink-0" />
              )}
              <p className="group-data-truncate/line:min-w-0 group-data-truncate/line:shrink group-data-truncate/line:truncate">
                {volume.is_pending_resize
                  ? "Expanding"
                  : usagePercentage !== undefined
                    ? `${percentageFormatter(usagePercentage)}%`
                    : "Unknown usage"}
              </p>
            </div>
            <p className="min-w-0 shrink truncate text-right">Storage {index + 1}</p>
          </div>
        </div>
      </Button>
    </VolumePanel>
  );
}
