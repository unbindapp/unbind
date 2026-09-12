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
import { TServer } from "@/lib/queries/servers";
import { ActivityIcon } from "lucide-react";

type TProps = {
  server: TServer;
  error: string | undefined;
};

const conditionLevels = {
  healthy: "success",
  unhealthy: "error",
  unknown: "muted",
} as const;

export default function StatusSection({ server, error }: TProps) {
  const status = getServerStatus(server);

  const rows: TInfoRow[] = [
    {
      label: "Status",
      value: <Value level={getServerStatusLevel(status)}>{serverStatusTitles[status]}</Value>,
    },
    {
      label: "Scheduling",
      value: (
        <Value level={server.unschedulable ? "warning" : "success"}>
          {server.unschedulable ? "Paused" : "Enabled"}
        </Value>
      ),
    },
    ...server.conditions.map((condition) => ({
      label: serverConditionTitles[condition.type],
      value: (
        <Value level={conditionLevels[condition.status]}>
          {serverConditionTexts[condition.type][condition.status]}
        </Value>
      ),
    })),
  ];

  return (
    <SettingsSection
      classNameContent="p-0 sm:p-0"
      title="Status"
      Icon={ActivityIcon}
      entityId={`server-status-${server.name}`}
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

function Value({
  level,
  children,
}: {
  level: "success" | "warning" | "error" | "muted";
  children: string;
}) {
  return (
    <span
      data-level={level}
      className="data-[level=error]:text-destructive data-[level=success]:text-success data-[level=warning]:text-warning data-[level=muted]:text-muted-foreground"
    >
      {children}
    </span>
  );
}
