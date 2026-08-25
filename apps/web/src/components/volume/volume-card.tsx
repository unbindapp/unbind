import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import VolumePanel from "@/components/volume/panel/volume-panel";
import { formatGB } from "@/lib/helpers/format-gb";
import { TVolumeShallow } from "@/lib/queries/services";
import { HardDriveIcon, HourglassIcon } from "lucide-react";

type TProps = {
  volume: TVolumeShallow;
  teamId: string;
  projectId: string;
  environmentId: string;
  className?: string;
};

export default function VolumeCard({
  volume,
  teamId,
  projectId,
  environmentId,
  className,
}: TProps) {
  return (
    <li className={cn("group/item flex min-h-38 w-full flex-col p-1", className)}>
      <VolumePanel
        volume={volume}
        teamId={teamId}
        projectId={projectId}
        environmentId={environmentId}
      >
        <Button
          variant="ghost"
          className="bg-background-hover flex w-full flex-1 flex-col items-start gap-6 rounded-xl border px-5 py-3.5 text-left font-semibold"
        >
          <div className="flex w-full items-center justify-start gap-2">
            {volume.is_pending_resize ? (
              <HourglassIcon className="animate-hourglass -ml-1 size-6 scale-90" />
            ) : (
              <HardDriveIcon className="-ml-1 size-6" />
            )}
            <h3 className="min-w-0 shrink overflow-hidden leading-tight text-ellipsis whitespace-nowrap">
              {volume.name}
            </h3>
          </div>
          <div className="flex w-full flex-1 flex-col justify-end">
            <div className="text-muted-foreground flex w-full items-center justify-between gap-4 text-sm font-normal">
              <p className="min-w-0 shrink truncate">
                {volume.is_pending_resize ? "Expanding" : formatGB(volume.capacity_gb)}
              </p>
              <p className="min-w-0 shrink truncate text-right">Not attached</p>
            </div>
          </div>
        </Button>
      </VolumePanel>
    </li>
  );
}
