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
  forcePending?: boolean;
};

export default function DeploymentInstances({ forcePending, className }: TProps) {
  const { data, isPending, error } = useInstanceHealth();

  if (isPending || forcePending)
    return (
      <div className={cn("flex w-full flex-wrap gap-1", className)}>
        <div className="bg-background border-muted-foreground/12 flex overflow-hidden rounded-md border">
          <div className="p-1">
            <div className="bg-muted-foreground animate-skeleton size-3.5 rounded-full" />
          </div>
          <div className="bg-muted-foreground/12 w-px self-stretch" />
          <div className="bg-muted-foreground/6 p-1">
            <div className="bg-muted-foreground animate-skeleton size-3.5 rounded-full" />
          </div>
        </div>
      </div>
    );
  if (data) {
    return (
      <div className={cn("flex w-full flex-wrap gap-1", className)}>
        {data.data.instances.map((instance, i) => (
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
      className="bg-background data-[status=waiting]:border-warning/16 data-[status=starting]:border-process/16 data-[status=not_ready]:border-process/16 data-[status=running]:border-success/16 data-[status=crashing]:border-destructive/16 group/div flex overflow-hidden rounded-md border"
    >
      <div className="p-1">
        <ServerIcon className="text-muted-foreground size-3.5" />
      </div>
      <div className="bg-border group-data-[status=waiting]/div:bg-warning/16 group-data-[status=starting]/div:bg-process/16 group-data-[status=not_ready]/div:bg-process/16 group-data-[status=running]/div:bg-success/16 group-data-[status=crashing]/div:bg-destructive/16 w-px self-stretch" />
      <div className="group-data-[status=waiting]/div:bg-warning/8 group-data-[status=starting]/div:bg-process/8 group-data-[status=not_ready]/div:bg-process/8 group-data-[status=running]/div:bg-success/8 group-data-[status=crashing]/div:bg-destructive/8 p-1">
        <div className="size-3.5 shrink-0">
          <Indicator instance={instance} />
        </div>
      </div>
    </div>
  );
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
  if (instance.status === "terminated") {
    return <CircleSlashIcon className="text-muted-foreground size-full" />;
  }
  return <CircleHelpIcon className="text-foreground size-full" />;
}
