import { useNow } from "@/components/providers/now-provider";
import { cn } from "@/components/ui/utils";
import { sourceToTitle } from "@/lib/constants";
import { getDurationStr, useTimeDifference } from "@/lib/hooks/use-time-difference";
import { TService, TServiceShallow } from "@/server/trpc/api/services/types";
import {
  CircleCheckBigIcon,
  HourglassIcon,
  LoaderIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { ReactNode, useMemo } from "react";

type TProps = {
  service: TService;
  className?: string;
};

export default function LastDeploymentInfo({ service, className }: TProps) {
  const lastDeployment = service.last_deployment;

  return (
    <div
      className={cn(
        "text-muted-foreground flex w-full items-center justify-start gap-2",
        className,
      )}
    >
      {lastDeployment && <StatusIndicator deployment={lastDeployment} />}
      <StatusText service={service} />
    </div>
  );
}

function StatusTextWrapper({
  service,
  children,
}: {
  service: TServiceShallow;
  children: ReactNode;
}) {
  const lastDeployment = service.last_deployment;
  const color = useMemo(() => {
    if (lastDeployment?.status === "crashing") return "destructive";
    if (lastDeployment?.status === "build-failed") return "destructive";
    return "default";
  }, [lastDeployment?.status]);

  return (
    <p
      data-color={color}
      suppressHydrationWarning
      className="data-[color=destructive]:text-destructive min-w-0 shrink truncate"
    >
      {children}
    </p>
  );
}

function StatusWithDuration({
  service,
  duration,
  children,
}: {
  service: TServiceShallow;
  duration: string;
  children: ReactNode;
}) {
  return (
    <StatusTextWrapper service={service}>
      {children}
      <span className="text-muted-more-foreground px-[0.75ch]">|</span>
      <span className="font-mono" suppressHydrationWarning>
        {duration}
      </span>
    </StatusTextWrapper>
  );
}

function StatusText({ service }: { service: TServiceShallow }) {
  const deployment = service.last_deployment;
  const { str: timeDiffStr } = useTimeDifference({
    timestamp: deployment ? new Date(deployment.created_at).getTime() : 0,
  });

  const now = useNow();
  const durationStr = getDurationStr({
    end: now,
    start: new Date(deployment?.created_at || now).getTime(),
  });

  if (!deployment) return "No deployments yet";
  if (deployment.status === "build-queued") {
    return (
      <StatusWithDuration service={service} duration={durationStr}>
        Build queued
      </StatusWithDuration>
    );
  }
  if (deployment.status === "build-pending") {
    return (
      <StatusWithDuration service={service} duration={durationStr}>
        Pending build
      </StatusWithDuration>
    );
  }
  if (deployment.status === "build-running") {
    return (
      <StatusWithDuration service={service} duration={durationStr}>
        Building
      </StatusWithDuration>
    );
  }
  if (deployment.status === "build-succeeded" || deployment.status === "launching") {
    return <StatusTextWrapper service={service}>Launching</StatusTextWrapper>;
  }
  if (deployment.status === "launch-error") {
    return <StatusTextWrapper service={service}>Launch error</StatusTextWrapper>;
  }
  if (deployment.status === "build-failed") {
    return <StatusTextWrapper service={service}>Build failed</StatusTextWrapper>;
  }
  if (deployment.status === "build-cancelled") {
    return <StatusTextWrapper service={service}>Build cancelled</StatusTextWrapper>;
  }
  if (deployment.status === "crashing") {
    return <StatusTextWrapper service={service}>Crashing</StatusTextWrapper>;
  }
  if (deployment.status === "removed") {
    return <StatusTextWrapper service={service}>Deployment removed</StatusTextWrapper>;
  }
  if (deployment.status === "active")
    return (
      <StatusTextWrapper service={service}>
        {timeDiffStr} via {sourceToTitle[service.type] || "Unknown"}
      </StatusTextWrapper>
    );
}

function StatusIndicator({ deployment }: { deployment: NonNullable<TService["last_deployment"]> }) {
  if (deployment.status === "build-queued" || deployment.status === "build-pending") {
    return <HourglassIcon className="animate-hourglass size-3.5 shrink-0" />;
  }
  if (
    deployment.status === "build-running" ||
    deployment.status === "build-succeeded" ||
    deployment.status === "launching"
  ) {
    return <LoaderIcon className="size-3.5 shrink-0 animate-spin" />;
  }
  if (deployment.status === "build-cancelled") {
    return <XIcon className="size-3.5 shrink-0" />;
  }
  if (deployment.status === "launch-error") {
    return <LoaderIcon className="text-destructive size-3.5 shrink-0 animate-spin" />;
  }
  if (deployment.status === "crashing") {
    return <TriangleAlertIcon className="text-destructive size-3.5 shrink-0" />;
  }
  if (deployment.status === "removed") {
    return <XIcon className="size-3.5 shrink-0" />;
  }
  return <CircleCheckBigIcon className="text-success size-3.5" />;
}
