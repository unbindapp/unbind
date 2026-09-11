import { formatCores, formatMegabytes } from "@/components/system/servers/format";
import UsageBar from "@/components/system/servers/usage-bar";
import { cn } from "@/components/ui/utils";
import { TServer } from "@/lib/queries/servers";
import { ServerIcon, TriangleAlertIcon } from "lucide-react";

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
  const warnings = getWarnings(s);
  const details = [s.os, s.architecture, s.kubernetes_version, s.internal_ip, s.external_ip].filter(
    (d) => d !== "",
  );

  return (
    <li
      data-placeholder={isPlaceholder || undefined}
      className={cn("group/item flex w-full flex-col p-1", className)}
    >
      <div className="bg-card flex w-full flex-1 flex-col gap-4 rounded-xl border px-4 py-3.5 sm:px-5">
        <div className="flex w-full items-start justify-between gap-3">
          <div className="flex min-w-0 shrink flex-col gap-1">
            <div className="flex min-w-0 items-center gap-2">
              <ServerIcon className="group-data-placeholder/item:bg-foreground group-data-placeholder/item:animate-skeleton -ml-0.5 size-5 shrink-0 group-data-placeholder/item:rounded-full group-data-placeholder/item:text-transparent" />
              <h3 className="group-data-placeholder/item:bg-foreground group-data-placeholder/item:animate-skeleton min-w-0 shrink truncate leading-tight font-semibold group-data-placeholder/item:rounded-md group-data-placeholder/item:text-transparent">
                {s.name}
              </h3>
            </div>
            <p className="text-muted-foreground group-data-placeholder/item:bg-muted-foreground group-data-placeholder/item:animate-skeleton min-w-0 truncate text-sm font-medium group-data-placeholder/item:rounded-md group-data-placeholder/item:text-transparent">
              {s.roles.length > 0 ? s.roles.join(", ") : "worker"}
            </p>
          </div>
          <StatusChip server={s} />
        </div>
        <div className="flex w-full flex-col gap-3">
          <UsageRow
            label="CPU"
            used={s.cpu_requested_millicores}
            total={s.cpu_allocatable_millicores}
            format={formatCores}
            unit="cores"
          />
          <UsageRow
            label="Memory"
            used={s.memory_requested_megabytes}
            total={s.memory_allocatable_megabytes}
            format={formatMegabytes}
          />
          <UsageRow label="Pods" used={s.pod_count} total={s.pod_capacity} />
        </div>
        {warnings.length > 0 && (
          <div className="flex w-full flex-wrap gap-1.5">
            {warnings.map((w) => (
              <p
                key={w}
                className="bg-destructive/3-10 border-destructive/3-10 text-destructive flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
              >
                <TriangleAlertIcon className="-ml-0.5 size-3.5 shrink-0" />
                {w}
              </p>
            ))}
          </div>
        )}
        <p className="text-muted-foreground group-data-placeholder/item:bg-muted-foreground group-data-placeholder/item:animate-skeleton mt-auto w-full text-xs font-medium wrap-break-word group-data-placeholder/item:rounded-md group-data-placeholder/item:text-transparent">
          {details.join(" · ")}
        </p>
      </div>
    </li>
  );
}

function UsageRow({
  label,
  used,
  total,
  format = (v: number) => v.toString(),
  unit,
}: {
  label: string;
  used: number;
  total: number;
  format?: (value: number) => string;
  unit?: string;
}) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      <div className="flex w-full items-center justify-between gap-3 text-sm">
        <p className="text-muted-foreground group-data-placeholder/item:bg-muted-foreground group-data-placeholder/item:animate-skeleton font-medium group-data-placeholder/item:rounded-md group-data-placeholder/item:text-transparent">
          {label}
        </p>
        <p className="group-data-placeholder/item:bg-muted-foreground group-data-placeholder/item:animate-skeleton min-w-0 shrink truncate font-medium group-data-placeholder/item:rounded-md group-data-placeholder/item:text-transparent">
          {format(used)}
          <span className="text-muted-foreground">
            {" "}
            / {format(total)}
            {unit ? ` ${unit}` : ""}
          </span>
        </p>
      </div>
      <UsageBar
        used={used}
        total={total}
        className="group-data-placeholder/item:animate-skeleton group-data-placeholder/item:bg-muted-foreground"
      />
    </div>
  );
}

function StatusChip({ server }: { server: TServer }) {
  const status = !server.ready ? "not-ready" : server.unschedulable ? "unschedulable" : "ready";
  return (
    <p
      data-status={status}
      className="bg-success/3-10 border-success/3-10 text-success data-[status=not-ready]:bg-destructive/3-10 data-[status=not-ready]:border-destructive/3-10 data-[status=not-ready]:text-destructive data-[status=unschedulable]:bg-warning/3-10 data-[status=unschedulable]:border-warning/3-10 data-[status=unschedulable]:text-warning group-data-placeholder/item:bg-muted-foreground group-data-placeholder/item:animate-skeleton shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold group-data-placeholder/item:border-transparent group-data-placeholder/item:text-transparent"
    >
      {status === "ready" ? "Ready" : status === "not-ready" ? "Not Ready" : "Unschedulable"}
    </p>
  );
}

function getWarnings(server: TServer): string[] {
  const warnings: string[] = [];
  if (server.memory_pressure) warnings.push("Memory pressure");
  if (server.disk_pressure) warnings.push("Disk pressure");
  if (server.pid_pressure) warnings.push("Process pressure");
  return warnings;
}
