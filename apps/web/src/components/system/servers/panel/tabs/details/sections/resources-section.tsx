import { SettingsSection } from "@/components/settings/settings-section";
import { formatCores, formatMegabytes } from "@/components/system/servers/format";
import { getUsageLevel, getUsagePercentage } from "@/components/system/servers/helpers";
import UsageBar from "@/components/system/servers/usage-bar";
import { TServer } from "@/lib/queries/servers";
import { ChartNoAxesColumnIcon } from "lucide-react";

type TProps = {
  server: TServer;
};

export default function ResourcesSection({ server }: TProps) {
  return (
    <SettingsSection
      title="Resources"
      Icon={ChartNoAxesColumnIcon}
      entityId={`server-resources-${server.name}`}
    >
      <div className="flex w-full flex-col gap-4">
        <ResourceRow
          title="CPU reserved"
          used={server.cpu_requested_millicores}
          total={server.cpu_allocatable_millicores}
          format={(value) => `${formatCores(value)} vCPU`}
        />
        <ResourceRow
          title="Memory reserved"
          used={server.memory_requested_megabytes}
          total={server.memory_allocatable_megabytes}
          format={formatMegabytes}
        />
        <ResourceRow
          title="Pods"
          used={server.pod_count}
          total={server.pod_capacity}
          format={(value) => `${value}`}
        />
      </div>
    </SettingsSection>
  );
}

function ResourceRow({
  title,
  used,
  total,
  format,
}: {
  title: string;
  used: number;
  total: number;
  format: (value: number) => string;
}) {
  const level = getUsageLevel({ used, total });

  return (
    <div data-usage={level} className="group/row flex w-full flex-col gap-1.5 font-medium">
      <div className="flex w-full items-end justify-between gap-4 px-1.5">
        <p className="text-muted-foreground min-w-0 shrink truncate">
          {title}:{" "}
          <span className="text-foreground group-data-[usage=high]/row:text-warning group-data-[usage=critical]/row:text-destructive font-semibold">
            {format(used)}
          </span>
        </p>
        <p className="text-muted-foreground max-w-1/2 min-w-0 shrink truncate text-right">
          of <span className="text-foreground font-semibold">{format(total)}</span>{" "}
          <span className="tabular-nums">({Math.round(getUsagePercentage({ used, total }))}%)</span>
        </p>
      </div>
      <UsageBar used={used} total={total} />
    </div>
  );
}
