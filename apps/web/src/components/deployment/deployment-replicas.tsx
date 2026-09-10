import ErrorLine from "@/components/error-line";
import { useReplicaHealth } from "@/components/replicas/replica-health-provider";
import { cn } from "@/components/ui/utils";
import { TReplicaFromHealth } from "@/lib/queries/replicas";
import {
  CircleHelpIcon,
  CircleSlashIcon,
  HeartIcon,
  HourglassIcon,
  LoaderIcon,
  ServerIcon,
  TriangleAlertIcon,
} from "lucide-react";

type TProps = {
  className?: string;
  isPending?: boolean;
};

export default function DeploymentReplicas({ isPending: isPendingProp, className }: TProps) {
  const { data, isPending, error } = useReplicaHealth();

  if (!data && !isPending && error) {
    return (
      <div className="flex w-full justify-start">
        <ErrorLine
          message={error.message}
          className={cn(
            "border-destructive/3-10 w-auto min-w-0 shrink rounded-md border px-2 py-1 text-xs leading-tight",
            className,
          )}
          classNameMessage="truncate whitespace-nowrap"
        />
        <IconWrapper className="shrink-0 border border-transparent">
          <div className="h-3.5 w-0" />
        </IconWrapper>
      </div>
    );
  }

  if (isPending || isPendingProp) {
    return (
      <div className={cn("flex w-full flex-wrap gap-1.5", className)}>
        <div className="bg-background border-muted-foreground/5-10 relative z-0 flex overflow-hidden rounded-md border">
          <IconWrapper>
            <div className="bg-muted-foreground animate-skeleton size-3.5 rounded-full" />
          </IconWrapper>
          <div className="bg-muted-foreground/5-10 w-px self-stretch" />
          <IconWrapper className="bg-muted-foreground/2-10">
            <div className="bg-muted-foreground animate-skeleton size-3.5 rounded-full" />
          </IconWrapper>
        </div>
      </div>
    );
  }

  if (data.data.replicas.length === 0) return null;

  const orderedReplicas = data.data.replicas.toSorted((a, b) => {
    return statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
  });

  return (
    <div className={cn("flex w-full flex-wrap gap-1.5", className)}>
      {orderedReplicas.map((replica, i) => (
        <Replica key={i} replica={replica} />
      ))}
    </div>
  );
}

function Replica({ replica }: { replica: TReplicaFromHealth }) {
  return (
    <div
      data-status={replica?.status}
      className="bg-background data-[status=waiting]:border-warning/6-10 data-[status=starting]:border-process/6-10 data-[status=not_ready]:border-process/6-10 data-[status=running]:border-success/6-10 data-[status=crashing]:border-destructive/6-10 group/div relative z-0 flex overflow-hidden rounded-md border"
    >
      <IconWrapper>
        <ServerIcon className="text-muted-foreground size-3.5" />
      </IconWrapper>
      <div className="bg-border group-data-[status=waiting]/div:bg-warning/6-10 group-data-[status=starting]/div:bg-process/6-10 group-data-[status=not_ready]/div:bg-process/6-10 group-data-[status=running]/div:bg-success/6-10 group-data-[status=crashing]/div:bg-destructive/6-10 w-px self-stretch" />
      <IconWrapper className="group-data-[status=waiting]/div:bg-warning/3-10 group-data-[status=starting]/div:bg-process/3-10 group-data-[status=not_ready]/div:bg-process/3-10 group-data-[status=running]/div:bg-success/3-10 group-data-[status=crashing]/div:bg-destructive/3-10">
        <div className="size-3.5 shrink-0">
          <Indicator replica={replica} />
        </div>
      </IconWrapper>
    </div>
  );
}

function IconWrapper({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("p-1.25", className)}>{children}</div>;
}

function Indicator({ replica }: { replica: TReplicaFromHealth }) {
  if (replica.status === "waiting") {
    return <HourglassIcon className="text-warning animate-hourglass size-full" />;
  }
  if (replica.status === "starting" || replica.status === "not_ready") {
    return <LoaderIcon className="text-process size-full animate-spin" />;
  }
  if (replica.status === "running") {
    return <HeartIcon className="text-success size-full" />;
  }
  if (replica.status === "crashing") {
    return <TriangleAlertIcon className="text-destructive size-full" />;
  }
  if (replica.status === "image_pull_error") {
    return <TriangleAlertIcon className="text-destructive size-full" />;
  }
  if (replica.status === "terminating") {
    return (
      <CircleSlashIcon className="text-muted-foreground size-full animate-spin duration-2000" />
    );
  }
  if (replica.status === "terminated") {
    return <CircleSlashIcon className="text-muted-foreground size-full" />;
  }
  return <CircleHelpIcon className="text-muted-foreground size-full" />;
}

const statusOrder: TReplicaFromHealth["status"][] = [
  "crashing",
  "image_pull_error",
  "running",
  "starting",
  "not_ready",
  "waiting",
  "terminating",
  "terminated",
];
