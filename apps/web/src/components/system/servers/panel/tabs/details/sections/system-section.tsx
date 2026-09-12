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

const UNKNOWN = "Unknown";

export default function SystemSection({ server, error }: TProps) {
  const { str: createdStr } = useTimeDifference({
    timestamp: server.created_at ? new Date(server.created_at).getTime() : 0,
  });

  const rows: TInfoRow[] = [
    { label: "External IP", value: server.external_ip || "None" },
    { label: "Internal IP", value: server.internal_ip || UNKNOWN },
    { label: "Roles", value: server.roles.join(", ") },
    { label: "Architecture", value: server.architecture },
    { label: "OS", value: server.os },
    { label: "Kubernetes", value: server.kubernetes_version },
    { label: "Creation", value: createdStr },
  ];

  return (
    <SettingsSection
      classNameContent="p-0 sm:p-0"
      title="System"
      Icon={InfoIcon}
      entityId={`server-system-${server.name}`}
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
