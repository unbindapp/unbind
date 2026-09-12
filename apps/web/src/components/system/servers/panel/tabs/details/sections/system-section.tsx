import ErrorLine from "@/components/error-line";
import { SettingsSection } from "@/components/settings/settings-section";
import InfoRows, { TInfoRow } from "@/components/system/servers/panel/tabs/details/info-rows";
import { useTimeDifference } from "@/lib/hooks/use-time-difference";
import { TServer, TServerDetail } from "@/lib/queries/servers";
import { InfoIcon } from "lucide-react";

type TProps = {
  server: TServer;
  detail: TServerDetail | undefined;
  error: string | undefined;
};

const unknown = "Unknown";
const loading = "•••";

export default function SystemSection({ server, detail, error }: TProps) {
  const { str: createdStr } = useTimeDifference({
    timestamp: server.created_at ? new Date(server.created_at).getTime() : 0,
  });

  const detailValue = (value: string | undefined) => {
    if (error) return unknown;
    if (detail === undefined) return loading;
    return value || unknown;
  };

  const rows: TInfoRow[] = [
    { label: "Roles", value: server.roles.join(", ") },
    { label: "Kubernetes", value: server.kubernetes_version },
    { label: "OS", value: server.os },
    { label: "Architecture", value: server.architecture },
    { label: "Kernel", value: detailValue(detail?.kernel_version) },
    { label: "Container runtime", value: detailValue(detail?.container_runtime) },
    { label: "Internal IP", value: server.internal_ip || unknown },
    { label: "External IP", value: server.external_ip || "None" },
    { label: "Schedulable", value: server.unschedulable ? "No" : "Yes" },
    { label: "Created", value: createdStr },
  ];

  return (
    <SettingsSection title="System" Icon={InfoIcon} entityId={`server-system-${server.name}`}>
      <div className="flex w-full flex-col gap-3">
        {error && <ErrorLine withIcon message={error} />}
        <InfoRows rows={rows} />
        {detail !== undefined && detail.taints.length > 0 && (
          <InfoRows
            rows={detail.taints.map((taint) => ({
              label: taint.value ? `${taint.key}=${taint.value}` : taint.key,
              value: taint.effect,
            }))}
          />
        )}
      </div>
    </SettingsSection>
  );
}
