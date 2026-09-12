import ErrorLine from "@/components/error-line";
import { SettingsSection } from "@/components/settings/settings-section";
import {
  getServerStatus,
  getServerStatusLevel,
  serverConditionTexts,
  serverConditionTitles,
  serverStatusTitles,
} from "@/components/system/servers/helpers";
import InfoRows, { TInfoRow } from "@/components/system/servers/panel/tabs/details/info-rows";
import { TServer, TServerCondition, TServerConditionType } from "@/lib/queries/servers";
import {
  ActivityIcon,
  CheckIcon,
  CircleAlertIcon,
  CircleHelpIcon,
  HardDriveIcon,
  HeartIcon,
  InboxIcon,
  ListTreeIcon,
  LucideIcon,
  MemoryStickIcon,
  NetworkIcon,
  TriangleAlertIcon,
} from "lucide-react";

type TProps = {
  server: TServer;
  error: string | undefined;
};

type TLevel = "success" | "warning" | "error" | "muted";

const conditionIcons: Record<TServerConditionType, LucideIcon> = {
  memory: MemoryStickIcon,
  disk: HardDriveIcon,
  processes: ListTreeIcon,
  network: NetworkIcon,
};

const conditionLevels: Record<TServerCondition["status"], TLevel> = {
  healthy: "success",
  unhealthy: "error",
  unknown: "muted",
};

const levelIcons: Record<TLevel, LucideIcon> = {
  success: CheckIcon,
  warning: CircleAlertIcon,
  error: TriangleAlertIcon,
  muted: CircleHelpIcon,
};

const levelTexts: Record<TLevel, string> = {
  success: "text-success",
  warning: "text-warning",
  error: "text-destructive",
  muted: "text-muted-foreground",
};

export default function HealthSection({ server, error }: TProps) {
  const status = getServerStatus(server);

  const rows: TInfoRow[] = [
    healthRow({
      label: "Status",
      IconLabel: ActivityIcon,
      level: getServerStatusLevel(status),
      value: serverStatusTitles[status],
    }),
    healthRow({
      label: "Scheduling",
      IconLabel: InboxIcon,
      level: server.unschedulable ? "warning" : "success",
      value: server.unschedulable ? "Paused" : "Enabled",
    }),
    ...server.conditions.map((condition) =>
      healthRow({
        label: serverConditionTitles[condition.type],
        IconLabel: conditionIcons[condition.type],
        level: conditionLevels[condition.status],
        value: serverConditionTexts[condition.type][condition.status],
      }),
    ),
  ];

  return (
    <SettingsSection
      classNameContent="p-0 sm:p-0"
      title="Health"
      Icon={HeartIcon}
      entityId={`server-health-${server.name}`}
    >
      <div className="flex w-full flex-col">
        {error && (
          <ErrorLine className="rounded-none px-4 py-2.75 sm:px-4.5" withIcon message={error} />
        )}
        <InfoRows rows={rows} className={error ? "border-t" : ""} />
      </div>
    </SettingsSection>
  );
}

function healthRow({
  label,
  IconLabel,
  level,
  value,
}: {
  label: string;
  IconLabel: LucideIcon;
  level: TLevel;
  value: string;
}): TInfoRow {
  return {
    label,
    IconLabel,
    IconValue: levelIcons[level],
    classNameValue: levelTexts[level],
    value,
  };
}
