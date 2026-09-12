import { SettingsSection } from "@/components/settings/settings-section";
import { formatCores, formatMegabytes } from "@/components/system/servers/format";
import { getUsageLevel } from "@/components/system/servers/helpers";
import { appLocale } from "@/lib/constants";
import { TServer } from "@/lib/queries/servers";
import {
  ChartNoAxesColumnIcon,
  CpuIcon,
  LucideIcon,
  MemoryStickIcon,
  ServerIcon,
} from "lucide-react";

type TProps = {
  server: TServer;
};

export default function ResourcesSection({ server }: TProps) {
  return (
    <SettingsSection
      title="Resources"
      Icon={ChartNoAxesColumnIcon}
      entityId={`server-resources-${server.name}`}
      classNameContent="px-0 py-0 sm:px-0 sm:py-0"
    >
      <div className="flex w-full flex-col">
        <ResourceRow
          title={`${formatCores(server.cpu_allocatable_millicores)} vCPU`}
          Icon={CpuIcon}
          used={server.cpu_requested_millicores}
          total={server.cpu_allocatable_millicores}
        />
        <ResourceRow
          title={`${formatMegabytes(server.memory_allocatable_megabytes)} RAM`}
          Icon={MemoryStickIcon}
          used={server.memory_requested_megabytes}
          total={server.memory_allocatable_megabytes}
        />
        <ResourceRow
          title={`${server.pod_capacity} Replicas`}
          Icon={ServerIcon}
          used={server.pod_count}
          total={server.pod_capacity}
        />
      </div>
    </SettingsSection>
  );
}

function ResourceRow({
  title,
  Icon,
  used,
  total,
}: {
  title: string;
  Icon: LucideIcon;
  used: number;
  total: number;
}) {
  const level = getUsageLevel({ used, total });
  const ratio = total > 0 ? Math.min(1, Math.max(0, used / total)) : 0;
  const percentage = ratio * 100;

  return (
    <div
      data-usage={level}
      className="group/line relative flex w-full flex-col gap-3 border-t px-4 py-2.75 font-medium first:border-t-0 sm:px-4.5"
    >
      <div className="absolute top-0 left-0 h-full w-full">
        <div
          style={{ transform: `scaleX(${Math.ceil(percentage)}%)` }}
          className="bg-foreground/1-10 group-data-[usage=high]/line:bg-warning/3-10 group-data-[usage=critical]/line:bg-destructive/3-10 h-full w-full origin-left"
        />
      </div>
      <div className="flex w-full items-center justify-between gap-6 px-0.5">
        <p className="text-foreground group-data-placeholder/line:bg-foreground group-data-placeholder/line:animate-skeleton -ml-0.5 min-w-0 shrink truncate leading-tight font-medium group-data-placeholder/line:rounded-md group-data-placeholder/line:text-transparent">
          <Icon className="mr-[0.5ch] mb-0.75 inline-block size-4" />
          {title}
        </p>
        <div className="flex max-w-1/2 min-w-0 flex-col items-end">
          <p className="group-data-placeholder/line:bg-muted-foreground group-data-placeholder/line:animate-skeleton text-muted-foreground group-data-[usage=high]/line:text-warning group-data-[usage=critical]/line:text-destructive w-full shrink truncate text-right leading-tight font-medium group-data-placeholder/line:rounded-md group-data-placeholder/line:text-transparent">
            {percentage.toLocaleString(appLocale, {
              maximumFractionDigits: 1,
            })}
            %
          </p>
        </div>
      </div>
    </div>
  );
}
