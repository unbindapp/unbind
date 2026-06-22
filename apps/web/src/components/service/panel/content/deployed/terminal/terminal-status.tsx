import { cn } from "@/components/ui/utils";

export type TTerminalStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

const labels: Record<TTerminalStatus, string> = {
  connecting: "Connecting",
  connected: "Connected",
  reconnecting: "Reconnecting",
  disconnected: "Disconnected",
};

function toDataStatus(status: TTerminalStatus) {
  if (status === "connected") return "connected";
  if (status === "disconnected") return "error";
  return "pending";
}

export default function TerminalStatus({
  status,
  isPending,
  className,
}: {
  status: TTerminalStatus;
  isPending?: boolean;
  className?: string;
}) {
  return (
    <div
      data-pending={isPending || undefined}
      data-status={isPending ? undefined : toDataStatus(status)}
      className={cn(
        "group/status data-pending:animate-skeleton text-ms flex min-w-0 shrink items-center gap-1.25 rounded-md px-2 py-1.75 text-xs font-medium",
        className,
      )}
    >
      <div className="group-data-pending/status:bg-muted-foreground bg-muted-more-foreground group-data-[status=connected]/status:bg-success group-data-[status=error]/status:bg-destructive group-data-[status=pending]/status:bg-warning -ml-0.5 size-1.5 shrink-0 rounded-full group-data-[status=pending]/status:animate-ping" />
      <div className="group-data-[status=connected]/status:text-success group-data-[status=error]/status:text-destructive group-data-[status=pending]/status:text-warning flex min-w-0 shrink overflow-hidden leading-tight">
        <p className="group-data-pending/status:bg-muted-foreground min-w-0 shrink truncate group-data-pending/status:rounded-sm group-data-pending/status:text-transparent">
          {labels[status]}
        </p>
      </div>
    </div>
  );
}
