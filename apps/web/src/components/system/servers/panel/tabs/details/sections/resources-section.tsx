import { SettingsSection } from "@/components/settings/settings-section";
import { formatCores, formatMegabytes } from "@/components/system/servers/format";
import {
  getUsageLevel,
  getUsagePercentage,
  TUsageLevel,
} from "@/components/system/servers/helpers";
import InfoRows, { TInfoRow } from "@/components/system/servers/panel/tabs/details/info-rows";
import { cn } from "@/components/ui/utils";
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

const usageFills: Record<TUsageLevel, string> = {
  normal: "bg-foreground/1-10",
  unknown: "bg-foreground/1-10",
  high: "bg-warning/3-10",
  critical: "bg-destructive/3-10",
};

const usageTexts: Record<TUsageLevel, string> = {
  normal: "text-muted-foreground",
  unknown: "text-muted-foreground",
  high: "text-warning",
  critical: "text-destructive",
};

export default function ResourcesSection({ server }: TProps) {
  const rows: TInfoRow[] = [
    usageRow({
      label: `${formatCores(server.cpu_allocatable_millicores)} vCPU`,
      Icon: CpuIcon,
      used: server.cpu_requested_millicores,
      total: server.cpu_allocatable_millicores,
    }),
    usageRow({
      label: `${formatMegabytes(server.memory_allocatable_megabytes)} RAM`,
      Icon: MemoryStickIcon,
      used: server.memory_requested_megabytes,
      total: server.memory_allocatable_megabytes,
    }),
    usageRow({
      label: `${server.pod_capacity} Replicas`,
      Icon: ServerIcon,
      used: server.pod_count,
      total: server.pod_capacity,
    }),
  ];

  return (
    <SettingsSection
      title="Resources"
      Icon={ChartNoAxesColumnIcon}
      entityId={`server-resources-${server.name}`}
      classNameContent="px-0 py-0 sm:px-0 sm:py-0"
    >
      <InfoRows rows={rows} />
    </SettingsSection>
  );
}

function usageRow({
  label,
  Icon,
  used,
  total,
}: {
  label: string;
  Icon: LucideIcon;
  used: number;
  total: number;
}): TInfoRow {
  const level = getUsageLevel({ used, total });
  const percentage = getUsagePercentage({ used, total });

  return {
    label,
    Icon,
    classNameLabel: "text-foreground",
    classNameValue: usageTexts[level],
    value: `${percentage.toLocaleString(appLocale, { maximumFractionDigits: 1 })}%`,
    background: (
      <div className="absolute top-0 left-0 h-full w-full">
        <div
          style={{ transform: `scaleX(${Math.ceil(percentage)}%)` }}
          className={cn("h-full w-full origin-left", usageFills[level])}
        />
      </div>
    ),
  };
}
