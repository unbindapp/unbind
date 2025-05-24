import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import VolumePanel from "@/components/volume/panel/volume-panel";
import { TVolumeShallow } from "@/server/trpc/api/services/types";
import { HardDriveIcon } from "lucide-react";
import { useMemo } from "react";

type TProps = {
  volume: TVolumeShallow;
  teamId: string;
  projectId: string;
  environmentId: string;
  index: number;
  className?: string;
};

type TUsageLevel = "low" | "high";

export default function VolumeLine({
  volume,
  teamId,
  projectId,
  environmentId,
  index,
  className,
}: TProps) {
  const usagePercentage = useMemo(() => {
    if (!volume.used_gb || !volume.size_gb) return undefined;
    return Math.min(Math.max(0, Math.ceil((volume.used_gb / volume.size_gb) * 100)), 100);
  }, [volume]);

  const usageLevel: TUsageLevel = useMemo(() => {
    if (usagePercentage !== undefined && usagePercentage >= 85) return "high";
    return "low";
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
        data-no-percentage={usagePercentage === undefined ? true : undefined}
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
                transform: `scaleX(${usagePercentage}%)`,
              }}
              className="bg-foreground/6 group-data-[usage=high]/line:bg-warning/8 h-full w-full origin-left"
            />
          </div>
        )}
        <div className="text-muted-foreground group-data-[usage=high]/line:text-warning flex w-full items-center justify-between gap-4 px-4">
          <div className="relative flex w-full items-center justify-between gap-4 leading-tight font-medium">
            <div className="flex shrink-0 items-center justify-start gap-1.25 group-data-no-percentage/line:gap-2">
              <HardDriveIcon className="size-3.5" />
              {usagePercentage !== undefined && <p>{usagePercentage}%</p>}
              {usagePercentage === undefined && (
                <p className="min-w-0 shrink truncate text-right">Storage {index + 1}</p>
              )}
            </div>
            {usagePercentage !== undefined && (
              <p className="min-w-0 shrink truncate text-right">Storage {index + 1}</p>
            )}
          </div>
        </div>
      </Button>
    </VolumePanel>
  );
}
