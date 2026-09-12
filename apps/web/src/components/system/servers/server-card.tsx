import { formatCores, formatMegabytes } from "@/components/system/servers/format";
import { serverPanelServerNameKey } from "@/components/system/servers/panel/constants";
import ServerPanel from "@/components/system/servers/panel/server-panel";
import ServerStatusLine from "@/components/system/servers/server-status-line";
import ServerUsageLine from "@/components/system/servers/server-usage-line";
import { Button, LinkButton } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { TServer } from "@/lib/queries/servers";
import { CpuIcon, MemoryStickIcon, MonitorIcon } from "lucide-react";
import { ReactElement } from "react";

type TProps = {
  className?: string;
} & ({ server: TServer; isPlaceholder?: never } | { server?: never; isPlaceholder: true });

const cardClassName =
  "flex w-full flex-1 flex-col items-start gap-6 overflow-hidden rounded-xl rounded-b-none border border-b-0 px-5 py-3.5 text-left font-semibold";

const placeholderServer: TServer = {
  name: "server-1",
  ready: true,
  unschedulable: false,
  roles: ["control-plane"],
  created_at: "",
  os: "Linux",
  architecture: "amd64",
  kubernetes_version: "v1.31.0",
  internal_ip: "10.0.0.1",
  external_ip: "",
  cpu_allocatable_millicores: 4000,
  cpu_requested_millicores: 0,
  memory_allocatable_megabytes: 8192,
  memory_requested_megabytes: 0,
  pod_count: 0,
  pod_capacity: 110,
  conditions: [],
};

export default function ServerCard({ server, isPlaceholder, className }: TProps) {
  const s = isPlaceholder ? placeholderServer : server;

  const cardContent = (
    <>
      <div className="flex w-full min-w-0 items-center justify-start gap-2">
        <MonitorIcon className="group-data-placeholder/item:bg-foreground group-data-placeholder/item:animate-skeleton -ml-1 size-5 shrink-0 group-data-placeholder/item:rounded-full group-data-placeholder/item:text-transparent" />
        <h3 className="group-data-placeholder/item:bg-foreground group-data-placeholder/item:animate-skeleton min-w-0 shrink truncate leading-tight group-data-placeholder/item:rounded-md group-data-placeholder/item:text-transparent">
          {s.name}
        </h3>
      </div>
      <div className="relative flex w-full flex-1 flex-col justify-end">
        <div className="-mx-0.5 flex w-[calc(100%+0.25rem)] items-center justify-between gap-4 text-sm font-normal">
          {!isPlaceholder ? (
            <ServerStatusLine server={s} className="truncate" />
          ) : (
            <p className="bg-muted-foreground animate-skeleton min-w-0 shrink truncate rounded-md text-transparent">
              Ready
            </p>
          )}
          <p
            className={cn(
              "text-muted-foreground max-w-1/2 min-w-0 shrink truncate text-right",
              isPlaceholder && "bg-muted-foreground animate-skeleton rounded-md text-transparent",
            )}
          >
            {s.roles.join(", ")}
          </p>
        </div>
      </div>
    </>
  );

  return (
    <li
      data-placeholder={isPlaceholder || undefined}
      className={cn("group/item flex min-h-40 w-full flex-col p-1", className)}
    >
      <ServerPanelOrPlaceholder {...(isPlaceholder ? { isPlaceholder: true } : { server: s })}>
        {isPlaceholder ? (
          <Button variant="card" className={cardClassName}>
            {cardContent}
          </Button>
        ) : (
          <LinkButton
            variant="card"
            from="/system"
            to="."
            search={(prev) => ({ ...prev, [serverPanelServerNameKey]: s.name })}
            replace={true}
            resetScroll={false}
            className={cardClassName}
          >
            {cardContent}
          </LinkButton>
        )}
      </ServerPanelOrPlaceholder>
      <div className="bg-background flex w-full text-xs">
        <ServerUsageLine
          used={s.cpu_requested_millicores}
          total={s.cpu_allocatable_millicores}
          totalLabel={`${formatCores(s.cpu_allocatable_millicores)} vCPU`}
          Icon={CpuIcon}
          className="rounded-bl-xl border-r-0"
        />
        <ServerUsageLine
          used={s.memory_requested_megabytes}
          total={s.memory_allocatable_megabytes}
          totalLabel={`${formatMegabytes(s.memory_allocatable_megabytes)} RAM`}
          Icon={MemoryStickIcon}
          className="rounded-br-xl"
        />
      </div>
    </li>
  );
}

function ServerPanelOrPlaceholder({
  server,
  isPlaceholder,
  children,
}: { children: ReactElement } & (
  { server: TServer; isPlaceholder?: never } | { server?: never; isPlaceholder: true }
)) {
  if (isPlaceholder) {
    return children;
  }

  return <ServerPanel server={server}>{children}</ServerPanel>;
}
