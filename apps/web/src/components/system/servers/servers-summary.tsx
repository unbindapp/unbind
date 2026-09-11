"use client";

import { formatCores, formatMegabytes } from "@/components/system/servers/format";
import { useSystem } from "@/components/system/system-provider";
import { cn } from "@/components/ui/utils";
import { formatGB } from "@/lib/helpers/format-gb";
import { serversListQuery } from "@/lib/queries/servers";
import { useQuery } from "@tanstack/react-query";

type TProps = {
  className?: string;
};

export default function ServersSummary({ className }: TProps) {
  const { data: serversData } = useQuery(serversListQuery());
  const { data: systemData } = useSystem();

  const servers = serversData?.data;
  const readyCount = servers?.filter((s) => s.ready).length;
  const cpuRequested = sum(servers, (s) => s.cpu_requested_millicores);
  const cpuAllocatable = sum(servers, (s) => s.cpu_allocatable_millicores);
  const memoryRequested = sum(servers, (s) => s.memory_requested_megabytes);
  const memoryAllocatable = sum(servers, (s) => s.memory_allocatable_megabytes);
  const availableStorageGb = systemData?.data.storage.available_storage_gb;

  return (
    <ul className={cn("flex w-full flex-wrap", className)}>
      <SummaryTile
        title="Servers"
        value={servers !== undefined ? `${servers.length}` : undefined}
        detail={
          servers !== undefined && readyCount !== undefined
            ? `${readyCount} of ${servers.length} ready`
            : undefined
        }
      />
      <SummaryTile
        title="CPU reserved"
        value={cpuRequested !== undefined ? formatCores(cpuRequested) : undefined}
        detail={
          cpuAllocatable !== undefined ? `of ${formatCores(cpuAllocatable)} cores` : undefined
        }
      />
      <SummaryTile
        title="Memory reserved"
        value={memoryRequested !== undefined ? formatMegabytes(memoryRequested) : undefined}
        detail={
          memoryAllocatable !== undefined ? `of ${formatMegabytes(memoryAllocatable)}` : undefined
        }
      />
      <SummaryTile
        title="Storage available"
        value={
          systemData === undefined
            ? undefined
            : availableStorageGb !== undefined
              ? formatGB(availableStorageGb)
              : "Unknown"
        }
        detail={systemData?.data.storage.storage_class_name}
      />
    </ul>
  );
}

function SummaryTile({
  title,
  value,
  detail,
}: {
  title: string;
  value: string | undefined;
  detail: string | undefined;
}) {
  const isPending = value === undefined;
  return (
    <li
      data-placeholder={isPending || undefined}
      className="group/item flex w-1/2 flex-col p-1 lg:w-1/4"
    >
      <div className="bg-card flex w-full flex-1 flex-col gap-1 rounded-xl border px-4 py-3">
        <p className="text-muted-foreground group-data-placeholder/item:bg-muted-foreground group-data-placeholder/item:animate-skeleton min-w-0 truncate text-sm font-medium group-data-placeholder/item:rounded-md group-data-placeholder/item:text-transparent">
          {title}
        </p>
        <p className="group-data-placeholder/item:bg-foreground group-data-placeholder/item:animate-skeleton min-w-0 truncate text-lg leading-tight font-semibold group-data-placeholder/item:rounded-md group-data-placeholder/item:text-transparent">
          {value ?? "0000"}
        </p>
        <p className="text-muted-foreground group-data-placeholder/item:bg-muted-foreground group-data-placeholder/item:animate-skeleton min-w-0 truncate text-sm font-medium group-data-placeholder/item:rounded-md group-data-placeholder/item:text-transparent">
          {detail ?? (isPending ? "Loading" : " ")}
        </p>
      </div>
    </li>
  );
}

function sum<T>(items: T[] | undefined, pick: (item: T) => number): number | undefined {
  if (items === undefined) return undefined;
  return items.reduce((total, item) => total + pick(item), 0);
}
