import OnlineIcon from "@/components/icons/online";
import {
  getServerStatus,
  getServerStatusLevel,
  serverStatusTitles,
  TServerStatus,
} from "@/components/system/servers/helpers";
import { cn } from "@/components/ui/utils";
import { TServer, TServerDetail } from "@/lib/queries/servers";
import { BanIcon, HardDriveIcon, MemoryStickIcon, TriangleAlertIcon } from "lucide-react";

type TProps = {
  server: TServer | TServerDetail;
  className?: string;
  classNameIcon?: string;
};

export default function ServerStatusLine({ server, className, classNameIcon }: TProps) {
  const status = getServerStatus(server);

  return (
    <div
      data-level={getServerStatusLevel(status)}
      className={cn(
        "text-muted-foreground data-[level=error]:text-destructive data-[level=warning]:text-warning flex min-w-0 shrink items-center justify-start gap-1.75",
        className,
      )}
    >
      <StatusIcon status={status} className={classNameIcon} />
      <p className="min-w-0 shrink truncate">{serverStatusTitles[status]}</p>
    </div>
  );
}

function StatusIcon({ status, className }: { status: TServerStatus; className?: string }) {
  const classNameFinal = cn("size-3.5 shrink-0", className);

  if (status === "ready") return <OnlineIcon className={cn("text-success", classNameFinal)} />;
  if (status === "unschedulable") return <BanIcon className={classNameFinal} />;
  if (status === "disk-pressure") return <HardDriveIcon className={classNameFinal} />;
  if (status === "memory-pressure") return <MemoryStickIcon className={classNameFinal} />;
  return <TriangleAlertIcon className={classNameFinal} />;
}
