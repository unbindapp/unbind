import ErrorLine from "@/components/error-line";
import { useInstanceHealth } from "@/components/instances/instance-health-provider";
import { cn } from "@/components/ui/utils";
import { TInstanceFromHealth } from "@/server/trpc/api/instances/types";
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

export default function DeploymentInstances({ isPending: isPendingProp, className }: TProps) {
  const { data, isPending, error } = useInstanceHealth();

  if (isPending || isPendingProp) {
    return (
      <div className={cn("flex w-full flex-wrap gap-1.5", className)}>
        <div className="bg-background border-muted-foreground/16 relative z-0 flex overflow-hidden rounded-md border">
          <IconWrapper>
            <div className="bg-muted-foreground animate-skeleton size-3.5 rounded-full" />
          </IconWrapper>
          <div className="bg-muted-foreground/16 w-px self-stretch" />
          <IconWrapper className="bg-muted-foreground/6">
            <div className="bg-muted-foreground animate-skeleton size-3.5 rounded-full" />
          </IconWrapper>
        </div>
      </div>
    );
  }

  if (data) {
    if (data.data.instances.length === 0) return null;
    const orderedInstances = data.data.instances.sort((a, b) => {
      return statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
    });

    return (
      <div className={cn("flex w-full flex-wrap gap-1.5", className)}>
        {orderedInstances.map((instance, i) => (
          <Instance key={i} instance={instance} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex w-full justify-start">
        <ErrorLine
          className={cn(
            "border-destructive/8 w-auto max-w-full rounded-md border px-2 py-[0.21875rem] text-xs leading-tight",
            className,
          )}
        />
      </div>
    );
  }
  return null;
}

function Instance({ instance }: { instance: TInstanceFromHealth }) {
  return (
    <div
      data-status={instance?.status}
      className="bg-background data-[status=waiting]:border-warning/20 data-[status=starting]:border-process/20 data-[status=not_ready]:border-process/20 data-[status=running]:border-success/20 data-[status=crashing]:border-destructive/20 group/div relative z-0 flex overflow-hidden rounded-md border"
    >
      <IconWrapper>
        <ServerIcon className="text-muted-foreground size-3.5" />
      </IconWrapper>
      <div className="bg-border group-data-[status=waiting]/div:bg-warning/20 group-data-[status=starting]/div:bg-process/20 group-data-[status=not_ready]/div:bg-process/20 group-data-[status=running]/div:bg-success/20 group-data-[status=crashing]/div:bg-destructive/20 w-px self-stretch" />
      <IconWrapper className="group-data-[status=waiting]/div:bg-warning/8 group-data-[status=starting]/div:bg-process/8 group-data-[status=not_ready]/div:bg-process/8 group-data-[status=running]/div:bg-success/8 group-data-[status=crashing]/div:bg-destructive/8">
        <div className="size-3.5 shrink-0">
          <Indicator instance={instance} />
        </div>
      </IconWrapper>
    </div>
  );
}

function IconWrapper({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("p-1.25", className)}>{children}</div>;
}

function Indicator({ instance }: { instance: TInstanceFromHealth }) {
  if (instance.status === "waiting") {
    return <HourglassIcon className="text-warning animate-hourglass size-full" />;
  }
  if (instance.status === "starting" || instance.status === "not_ready") {
    return <LoaderIcon className="text-process size-full animate-spin" />;
  }
  if (instance.status === "running") {
    return <HeartIcon className="text-success size-full" />;
  }
  if (instance.status === "crashing") {
    return <TriangleAlertIcon className="text-destructive size-full" />;
  }
  if (instance.status === "image_pull_error") {
    return <TriangleAlertIcon className="text-destructive size-full" />;
  }
  if (instance.status === "terminating") {
    return (
      <CircleSlashIcon className="text-muted-foreground size-full animate-spin duration-2000" />
    );
  }
  if (instance.status === "terminated") {
    return <CircleSlashIcon className="text-muted-foreground size-full" />;
  }
  return <CircleHelpIcon className="text-muted-foreground size-full" />;
}

const statusOrder: TInstanceFromHealth["status"][] = [
  "crashing",
  "image_pull_error",
  "running",
  "starting",
  "not_ready",
  "waiting",
  "terminating",
  "terminated",
];
