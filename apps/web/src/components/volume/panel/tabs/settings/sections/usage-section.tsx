import { SettingsSection } from "@/components/settings/settings-section";
import { getVolumeUsageLevel, percentageFormatter } from "@/components/volume/helpers";
import { formatGB } from "@/lib/helpers/format-gb";
import { TVolumeShallow } from "@/lib/queries/services";
import { ChartNoAxesColumnIcon, HourglassIcon } from "lucide-react";
import { useMemo } from "react";

type TProps = {
  volume: TVolumeShallow;
};

export default function UsageSection({ volume }: TProps) {
  const sectionHighlightId = useMemo(() => getEntityId(volume), [volume]);

  const usagePercentage =
    volume.used_gb !== undefined && volume.capacity_gb
      ? Math.min(Math.max(0, (volume.used_gb / volume.capacity_gb) * 100), 100)
      : undefined;

  const isUnattached = !volume.mounted_on_service_id;

  const usageInfo = volume.is_attaching
    ? "Attaching"
    : volume.is_pending_resize
      ? "Expanding"
      : usagePercentage !== undefined
        ? `${percentageFormatter(usagePercentage)}%`
        : isUnattached
          ? "Unknown"
          : "Measuring";

  const usageLevel = getVolumeUsageLevel(usagePercentage);

  return (
    <SettingsSection
      title="Usage"
      id="usage"
      entityId={sectionHighlightId}
      Icon={ChartNoAxesColumnIcon}
    >
      <div data-usage={usageLevel} className="group/section flex w-full flex-col gap-2 font-medium">
        <div className="text-muted-foreground flex w-full items-end justify-between px-1.5">
          <p className="max-w-1/2 truncate pr-2 font-medium">
            Used:{" "}
            {volume.used_gb !== undefined ? (
              <span className="text-foreground group-data-error/section:text-destructive group-data-[usage=high]/section:text-warning group-data-[usage=critical]/section:text-destructive font-semibold">
                {formatGB(volume.used_gb)}
              </span>
            ) : (
              <span className="font-semibold">{isUnattached ? "Unknown" : "Measuring"}</span>
            )}
          </p>
          <p className="max-w-1/2 truncate pl-2 text-right font-medium">
            Total:{" "}
            <span className="text-foreground group-data-error/section:text-destructive font-semibold">
              {formatGB(volume.capacity_gb)}
            </span>
          </p>
        </div>
        <div className="relative flex w-full items-center justify-start overflow-hidden rounded-lg border px-3 py-2.5">
          <div className="absolute top-0 left-0 h-full w-full">
            <div
              data-has-usage={usagePercentage !== undefined || undefined}
              style={
                usagePercentage !== undefined
                  ? { transform: `scaleX(${Math.ceil(usagePercentage)}%)` }
                  : undefined
              }
              className="data-has-usage:bg-foreground/8 data-has-usage:group-data-[usage=high]/section:bg-warning/8 data-has-usage:group-data-[usage=critical]/section:bg-destructive/8 h-full w-full origin-left"
            />
          </div>
          <div className="text-muted-foreground relative flex max-w-full min-w-0 items-center gap-1.5">
            {usagePercentage === undefined && !isUnattached && (
              <HourglassIcon className="animate-hourglass size-3.5 shrink-0 scale-90" />
            )}
            <p
              data-has-usage={usagePercentage !== undefined || undefined}
              className="data-has-usage:text-foreground group-data-[usage=high]/section:text-warning group-data-[usage=critical]/section:text-destructive group-data-error/section:text-destructive min-w-0 truncate leading-tight font-semibold"
            >
              {usageInfo}
            </p>
          </div>
        </div>
        {(usageLevel === "high" || usageLevel === "critical") && (
          <p className="text-foreground group-data-[usage=high]/section:text-warning group-data-[usage=critical]/section:text-destructive w-full px-2 pt-px text-sm font-normal">
            {usageLevel === "critical"
              ? "This volume is almost full. Consider expanding it now."
              : "This volume is filling up. Consider expanding it soon."}
          </p>
        )}
      </div>
    </SettingsSection>
  );
}

function getEntityId(volume: TVolumeShallow): string {
  return `usage_${volume.id}`;
}
