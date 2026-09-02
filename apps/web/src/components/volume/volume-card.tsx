import { LinkButton } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { getVolumeDisplayName } from "@/components/volume/helpers";
import { volumePanelVolumeIdKey } from "@/components/volume/panel/constants";
import VolumePanel from "@/components/volume/panel/volume-panel";
import { formatGB } from "@/lib/helpers/format-gb";
import { deleteMutationKeys, useIsDeleting } from "@/lib/hooks/use-is-deleting";
import { TVolumeShallow } from "@/lib/queries/services";
import { HardDriveIcon, LoaderIcon } from "lucide-react";
import { useMemo } from "react";

type TProps = {
  volume: TVolumeShallow;
  className?: string;
};

export default function VolumeCard({ volume, className }: TProps) {
  const isDeleting = useIsDeleting(deleteMutationKeys.volume(volume.id)) || volume.is_deleting;

  const bottomLeftTextAndIcon = useMemo(() => {
    if (isDeleting)
      return {
        icon: <LoaderIcon className="text-destructive size-3.5 shrink-0 animate-spin" />,
        text: "Deleting",
      };
    if (volume.is_detaching)
      return {
        icon: <LoaderIcon className="text-warning size-3.5 shrink-0 animate-spin" />,
        text: "Detaching",
      };
    if (volume.is_pending_resize)
      return {
        icon: <LoaderIcon className="text-warning size-3.5 shrink-0 animate-spin" />,
        text: "Expanding",
      };

    return {
      icon: null,
      text: "Not attached",
    };
  }, [isDeleting, volume.is_detaching, volume.is_pending_resize]);

  return (
    <li
      data-detaching={volume.is_detaching || undefined}
      data-deleting={isDeleting || undefined}
      data-pending-resize={volume.is_pending_resize || undefined}
      className={cn(
        "group/item data-deleting:animate-skeleton-smooth flex min-h-40 w-full flex-col p-1 transition-opacity duration-(--skeleton-smooth-lead-in) data-deleting:pointer-events-none data-deleting:opacity-(--skeleton-smooth-opacity)",
        className,
      )}
    >
      <VolumePanel volume={volume}>
        <LinkButton
          variant="card"
          from="/$team_id/project/$project_id"
          to="."
          search={(prev) => ({ ...prev, [volumePanelVolumeIdKey]: volume.id })}
          replace={true}
          resetScroll={false}
          disabled={isDeleting}
          className="flex w-full flex-1 flex-col items-start gap-6 rounded-xl border px-5 py-3.5 text-left font-semibold"
        >
          <div className="flex w-full items-center justify-start gap-2">
            <HardDriveIcon className="-ml-1 size-5" />
            <h3 className="min-w-0 shrink overflow-hidden leading-tight text-ellipsis whitespace-nowrap">
              {getVolumeDisplayName(volume)}
            </h3>
          </div>
          <div className="-mx-0.5 flex w-[calc(100%+0.25rem)] flex-1 flex-col items-center justify-end">
            <div className="text-muted-foreground flex w-full min-w-0 shrink items-center justify-between gap-4 overflow-hidden text-sm font-normal text-ellipsis whitespace-nowrap">
              <div className="flex min-w-0 shrink items-center gap-1.75">
                {bottomLeftTextAndIcon.icon}
                <p className="group-data-detaching/item:text-warning group-data-deleting/item:text-destructive group-data-pending-resize/item:text-warning min-w-0 shrink truncate">
                  {bottomLeftTextAndIcon.text}
                </p>
              </div>
              <p className="min-w-0 shrink truncate text-right">{formatGB(volume.capacity_gb)}</p>
            </div>
          </div>
        </LinkButton>
      </VolumePanel>
    </li>
  );
}
