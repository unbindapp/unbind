import { useStagedVolumeChange } from "@/components/staged-changes/staged-changes-provider";
import { LinkButton } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import {
  getVolumeDisplayName,
  getVolumeUsageLevel,
  percentageFormatter,
} from "@/components/volume/helpers";
import { useVolumePanel } from "@/components/volume/panel/volume-panel-provider";
import VolumePanel from "@/components/volume/panel/volume-panel";
import { TVolumeUsageLevel } from "@/components/volume/types";
import { TVolumeShallow } from "@/lib/queries/services";
import { ClockIcon, EjectIcon, HardDriveIcon, HourglassIcon } from "lucide-react";
import { useMemo } from "react";

type TProps = {
  volume: TVolumeShallow;
  className?: string;
};

export default function VolumeUsageLine({ volume, className }: TProps) {
  const { getOpenSearch } = useVolumePanel();
  const usagePercentage = useMemo(() => {
    if (volume.used_gb === undefined || !volume.capacity_gb) return undefined;
    return Math.min(Math.max(0, (volume.used_gb / volume.capacity_gb) * 100), 100);
  }, [volume]);

  const usageLevel: TVolumeUsageLevel = useMemo(() => {
    return getVolumeUsageLevel(usagePercentage);
  }, [usagePercentage]);

  const staged = useStagedVolumeChange(volume.id);
  const isUnmountStaged = staged?.mountPath === null;
  const status = isUnmountStaged
    ? getUnmountStatus(staged.isApplying)
    : getLineStatus(volume, usagePercentage);

  return (
    <VolumePanel volume={volume}>
      <LinkButton
        variant={"card"}
        data-usage={isUnmountStaged ? undefined : usageLevel}
        data-staged={isUnmountStaged || undefined}
        from="/$team_id/project/$project_id"
        to="."
        search={(prev) => ({ ...prev, ...getOpenSearch(volume.id) })}
        replace={true}
        resetScroll={false}
        className={cn(
          "group/line bg-background relative w-full overflow-hidden rounded-none border px-0 py-2",
          className,
        )}
      >
        {usagePercentage !== undefined &&
          !isUnmountStaged &&
          volume.mount_status !== "detaching" && (
            <div className="absolute top-0 left-0 h-full w-full">
              <div
                style={{
                  transform: `scaleX(${Math.ceil(usagePercentage)}%)`,
                }}
                className="bg-foreground/1-10 group-data-[usage=high]/line:bg-warning/3-10 group-data-[usage=critical]/line:bg-destructive/3-10 h-full w-full origin-left"
              />
            </div>
          )}
        <div className="text-muted-foreground group-data-[usage=high]/line:text-warning group-data-[usage=critical]/line:text-destructive group-data-staged/line:text-change flex w-full items-center justify-between gap-4 px-3">
          <div className="relative flex w-full items-center justify-between gap-8 leading-tight font-medium">
            <div
              data-truncate={usagePercentage === undefined || undefined}
              className="group/line flex min-w-0 shrink items-center gap-1.5"
            >
              {status.icon}
              <p className="group-data-truncate/line:min-w-0 group-data-truncate/line:shrink group-data-truncate/line:truncate">
                {status.text}
              </p>
            </div>
            <p className="max-w-[40%] min-w-0 shrink truncate text-right">
              {getVolumeDisplayName(volume)}
            </p>
          </div>
        </div>
      </LinkButton>
    </VolumePanel>
  );
}

function getUnmountStatus(isApplying: boolean) {
  if (isApplying) {
    return {
      icon: <HourglassIcon className="animate-hourglass size-3 min-w-0 shrink-0" />,
      text: "Unmounting",
    };
  }
  return { icon: <EjectIcon className="size-3.5 min-w-0 shrink-0" />, text: "Will unmount" };
}

function getLineStatus(volume: TVolumeShallow, usagePercentage: number | undefined) {
  const hourglass = <HourglassIcon className="animate-hourglass size-3 min-w-0 shrink-0" />;
  if (volume.mount_status === "detaching") return { icon: hourglass, text: "Unmounting" };
  if (volume.mount_status === "awaiting_deployment") {
    return {
      icon: <ClockIcon className="size-3.5 min-w-0 shrink-0" />,
      text: "Awaiting deployment",
    };
  }
  if (volume.mount_status === "attaching") return { icon: hourglass, text: "Mounting" };
  if (volume.is_pending_resize) return { icon: hourglass, text: "Expanding" };
  if (usagePercentage === undefined) return { icon: hourglass, text: "Measuring" };
  return {
    icon: <HardDriveIcon className="size-3.5 min-w-0 shrink-0" />,
    text: `${percentageFormatter(usagePercentage)}%`,
  };
}
