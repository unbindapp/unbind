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
  className,
}: {
  status: TTerminalStatus;
  className?: string;
}) {
  return (
    <div
      data-status={toDataStatus(status)}
      className={cn(
        "group/status text-muted-foreground bg-foreground/6 border-foreground/6 data-[status=connected]:border-success/8 data-[status=connected]:bg-success/8 data-[status=error]:border-destructive/8 data-[status=error]:bg-destructive/8 data-[status=pending]:border-warning/8 data-[status=pending]:bg-warning/8 text-ms flex min-w-0 shrink items-center gap-1.5 rounded-md border px-2.5 py-1.75 text-xs font-medium",
        className,
      )}
    >
      <div className="bg-muted-more-foreground group-data-[status=connected]/status:bg-success group-data-[status=error]/status:bg-destructive group-data-[status=pending]/status:bg-warning -ml-px size-1.5 shrink-0 rounded-full group-data-[status=pending]/status:animate-ping" />
      <div className="group-data-[status=connected]/status:text-success group-data-[status=error]/status:text-destructive group-data-[status=pending]/status:text-warning flex min-w-0 shrink overflow-hidden leading-tight">
        <p className="min-w-0 shrink truncate">{labels[status]}</p>
      </div>
    </div>
  );
}
