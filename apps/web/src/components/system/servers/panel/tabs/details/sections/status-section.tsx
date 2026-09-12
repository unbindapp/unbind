import ErrorLine from "@/components/error-line";
import { SettingsSection } from "@/components/settings/settings-section";
import ServerStatusLine from "@/components/system/servers/server-status-line";
import { cn } from "@/components/ui/utils";
import { TServer, TServerDetail } from "@/lib/queries/servers";
import { ActivityIcon } from "lucide-react";

type TProps = {
  server: TServer;
  detail: TServerDetail | undefined;
  error: string | undefined;
};

export default function StatusSection({ server, detail, error }: TProps) {
  return (
    <SettingsSection title="Status" Icon={ActivityIcon} entityId={`server-status-${server.name}`}>
      <div className="flex w-full flex-col gap-3">
        <div className="flex w-full items-center rounded-lg border px-3 py-2.5">
          <ServerStatusLine server={server} className="font-semibold" classNameIcon="size-4" />
        </div>
        {error && <ErrorLine withIcon message={error} />}
        {!error && (
          <ul className="flex w-full flex-col gap-2">
            {(detail?.conditions ?? placeholderConditions).map((condition) => (
              <li
                key={condition.type}
                data-placeholder={detail === undefined || undefined}
                data-problem={isProblem(condition) || undefined}
                className="group/condition data-problem:border-destructive/3-10 data-problem:bg-destructive/2-10 flex w-full flex-col gap-1 rounded-lg border px-3 py-2"
              >
                <div className="flex w-full items-center justify-between gap-3 font-medium">
                  <p className="group-data-placeholder/condition:bg-foreground group-data-placeholder/condition:animate-skeleton group-data-problem/condition:text-destructive min-w-0 shrink truncate group-data-placeholder/condition:rounded-md group-data-placeholder/condition:text-transparent">
                    {condition.type}
                  </p>
                  <p
                    className={cn(
                      "text-muted-foreground group-data-problem/condition:text-destructive max-w-1/2 min-w-0 shrink truncate text-right font-mono",
                      "group-data-placeholder/condition:bg-muted-foreground group-data-placeholder/condition:animate-skeleton group-data-placeholder/condition:rounded-md group-data-placeholder/condition:text-transparent",
                    )}
                  >
                    {condition.status}
                  </p>
                </div>
                <p className="text-muted-foreground group-data-placeholder/condition:bg-muted-foreground group-data-placeholder/condition:animate-skeleton min-w-0 text-sm leading-snug font-normal group-data-placeholder/condition:rounded-md group-data-placeholder/condition:text-transparent">
                  {condition.message || condition.reason || "No details"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SettingsSection>
  );
}

// A condition is bad news when it is Ready=False or any of the pressures is True
function isProblem(condition: TServerDetail["conditions"][number]) {
  if (condition.type === "Ready") return condition.status !== "True";
  return condition.status === "True";
}

const placeholderConditions: TServerDetail["conditions"] = [
  {
    type: "MemoryPressure",
    status: "False",
    reason: "KubeletHasSufficientMemory",
    message: "kubelet has sufficient memory available",
    last_transition_at: "",
  },
  {
    type: "DiskPressure",
    status: "False",
    reason: "KubeletHasNoDiskPressure",
    message: "kubelet has no disk pressure",
    last_transition_at: "",
  },
  {
    type: "Ready",
    status: "True",
    reason: "KubeletReady",
    message: "kubelet is posting ready status",
    last_transition_at: "",
  },
];
