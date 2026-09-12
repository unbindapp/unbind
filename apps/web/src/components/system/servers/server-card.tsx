import { formatCores, formatMegabytes } from "@/components/system/servers/format";
import { cn } from "@/components/ui/utils";
import { TServer } from "@/lib/queries/servers";
import { CpuIcon, LucideIcon, MemoryStickIcon, MonitorIcon } from "lucide-react";

type TProps = {
  className?: string;
} & ({ server: TServer; isPlaceholder?: never } | { server?: never; isPlaceholder: true });

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
  memory_pressure: false,
  disk_pressure: false,
  pid_pressure: false,
};

export default function ServerCard({ server, isPlaceholder, className }: TProps) {
  const s = isPlaceholder ? placeholderServer : server;

  return (
    <li
      data-placeholder={isPlaceholder || undefined}
      className={cn("group/item flex w-full flex-col p-1", className)}
    >
      <div className="bg-card flex min-h-38 w-full flex-1 flex-col overflow-hidden rounded-xl border">
        {/* Top Info */}
        <div className="flex w-full flex-1 items-start justify-between gap-6 px-4 py-3">
          <div className="flex min-w-0 shrink flex-col gap-1.5">
            <div className="flex min-w-0 items-center gap-2">
              <MonitorIcon className="group-data-placeholder/item:bg-foreground group-data-placeholder/item:animate-skeleton -ml-0.5 size-4.5 shrink-0 group-data-placeholder/item:rounded-full group-data-placeholder/item:text-transparent" />
              <h3 className="group-data-placeholder/item:bg-foreground group-data-placeholder/item:animate-skeleton min-w-0 shrink truncate leading-tight font-medium group-data-placeholder/item:rounded-md group-data-placeholder/item:text-transparent">
                {s.name}
              </h3>
            </div>
            <p className="text-muted-foreground group-data-placeholder/item:bg-muted-foreground group-data-placeholder/item:animate-skeleton min-w-0 truncate text-xs leading-tight font-normal group-data-placeholder/item:rounded-md group-data-placeholder/item:text-transparent">
              {s.roles.length > 0 ? s.roles.join(", ") : "worker"}
            </p>
          </div>
          <StatusChip server={s} className="-mt-1.5 -mr-2.5" />
        </div>
        <div className="bg-background flex w-full">
          <UsageRing
            used={s.cpu_requested_millicores}
            total={s.cpu_allocatable_millicores}
            format={formatCores}
            Icon={CpuIcon}
            suffix="vCPU"
            className="border-r"
          />
          <UsageRing
            used={s.memory_requested_megabytes}
            total={s.memory_allocatable_megabytes}
            format={formatMegabytes}
            Icon={MemoryStickIcon}
            suffix="RAM"
          />
        </div>
      </div>
    </li>
  );
}

function getUsageLevel({
  used,
  total,
}: {
  used: number;
  total: number;
}): "normal" | "high" | "critical" | "unknown" {
  if (total === 0) return "unknown";
  const usage = used / total;
  if (usage >= 0.9) return "critical";
  if (usage >= 0.75) return "high";
  return "normal";
}

function UsageRing({
  used,
  total,
  format,
  Icon,
  suffix,
  className,
}: {
  used: number;
  total: number;
  format: (value: number) => string;
  Icon: LucideIcon;
  suffix: string;
  className?: string;
}) {
  return (
    <div
      data-usage={getUsageLevel({ used, total })}
      className={cn(
        "group/line relative flex w-full items-center gap-1.5 border-t px-3.5 py-2 text-sm",
        className,
      )}
    >
      <div
        className="bg-foreground/2-10 group-data-[usage=high]/line:bg-warning/3-10 group-data-[usage=critical]/line:bg-destructive/3-10 absolute top-0 left-0 h-full w-full origin-left"
        style={{
          transform: `scaleX(${total !== 0 ? (used / total) * 100 : 0}%)`,
        }}
      />
      <Icon className="group-data-[usage=high]/line:text-warning group-data-[usage=critical]/line:text-destructive group-data-placeholder/item:bg-foreground group-data-placeholder/item:animate-skeleton size-4 shrink-0 group-data-placeholder/item:rounded-full group-data-placeholder/item:text-transparent" />
      <p className="group-data-[usage=high]/line:text-warning group-data-[usage=critical]/line:text-destructive group-data-placeholder/item:bg-foreground group-data-placeholder/item:animate-skeleton truncate leading-tight font-semibold group-data-placeholder/item:rounded-md group-data-placeholder/item:text-transparent">
        {format(total)} {suffix}
      </p>
    </div>
  );
}

function StatusChip({ server, className }: { server: TServer; className?: string }) {
  const status = !server.ready ? "not-ready" : server.unschedulable ? "unschedulable" : "ready";
  return (
    <p
      data-status={status}
      className={cn(
        "bg-success/3-10 border-success/3-10 text-success data-[status=not-ready]:bg-destructive/3-10 data-[status=not-ready]:border-destructive/3-10 data-[status=not-ready]:text-destructive data-[status=unschedulable]:bg-warning/3-10 data-[status=unschedulable]:border-warning/3-10 data-[status=unschedulable]:text-warning group-data-placeholder/item:bg-muted-foreground group-data-placeholder/item:animate-skeleton shrink-0 rounded-md border px-2 py-0.5 text-xs font-semibold group-data-placeholder/item:border-transparent group-data-placeholder/item:text-transparent",
        className,
      )}
    >
      {status === "ready" ? "Ready" : status === "not-ready" ? "Not Ready" : "Unschedulable"}
    </p>
  );
}
