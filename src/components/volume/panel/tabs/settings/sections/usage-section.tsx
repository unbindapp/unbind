import { getVolumeUsageLevel, percentageFormatter } from "@/components/volume/helpers";
import { formatGB } from "@/lib/helpers/format-gb";
import { TVolumeShallow } from "@/server/trpc/api/services/types";

type TProps = {
  volume: TVolumeShallow;
};

export default function UsageSection({ volume }: TProps) {
  const usagePercentage =
    volume.used_gb !== undefined && volume.capacity_gb !== undefined
      ? Math.min(Math.max(0, (volume.used_gb / volume.capacity_gb) * 100), 100)
      : undefined;

  const percentageString =
    usagePercentage !== undefined ? `${percentageFormatter(usagePercentage)}%` : "Unknown";

  const usageLevel = getVolumeUsageLevel(usagePercentage);

  return (
    <div
      data-usage={usageLevel}
      className="group/section flex w-full flex-col gap-2.5 leading-tight font-medium md:max-w-xl"
    >
      <div className="text-muted-foreground flex w-full items-end justify-between px-1.5">
        <p className="max-w-1/2 truncate pr-2 font-medium">
          Used:{" "}
          <span className="text-foreground group-data-error/section:text-destructive font-semibold">
            {volume.used_gb !== undefined ? formatGB(volume.used_gb) : "Unknown"}
          </span>
        </p>
        <p className="max-w-1/2 truncate pl-2 text-right font-medium">
          Total:{" "}
          <span className="text-foreground group-data-error/section:text-destructive font-semibold">
            {volume.capacity_gb !== undefined ? formatGB(volume.capacity_gb) : "Unknown"}
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
        <p className="group-data-[usage=high]/section:text-warning group-data-error/section:text-destructive relative max-w-full min-w-0 truncate font-semibold">
          {percentageString}
        </p>
      </div>
    </div>
  );
}
