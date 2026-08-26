import { NewEntityIndicator } from "@/components/new-entity-indicator";
import { useNow } from "@/components/providers/now-provider";
import ServicePanel from "@/components/service/panel/service-panel";
import ServiceIcon from "@/components/service/service-icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import VolumeLine from "@/components/volume/volume-line";
import { sourceToTitle } from "@/lib/constants";
import { useIntent } from "@/lib/hooks/use-intent";
import { getDurationStr, useTimeDifference } from "@/lib/hooks/use-time-difference";
import { deploymentsListQuery } from "@/lib/queries/deployments";
import { serviceQuery, TService, TServiceShallow } from "@/lib/queries/services";
import { useQueryClient } from "@tanstack/react-query";
import { HourglassIcon, LoaderIcon, OctagonXIcon, TriangleAlertIcon } from "lucide-react";
import { ReactNode, useMemo } from "react";

type TProps = {
  className?: string;
  classNameCard?: string;
  classNameVolumes?: string;
  classNameVolume?: string;
  classNameVolumeLast?: string;
} & (
  | {
      service: TServiceShallow;
      teamId: string;
      projectId: string;
      environmentId: string;
      isPlaceholder?: never;
    }
  | {
      service?: never;
      teamId?: never;
      projectId?: never;
      environmentId?: never;
      isPlaceholder: true;
    }
);

export default function ServiceCard({
  service,
  teamId,
  projectId,
  environmentId,
  isPlaceholder,
  className,
  classNameCard,
  classNameVolumes,
  classNameVolume,
  classNameVolumeLast,
}: TProps) {
  const panelProps = isPlaceholder
    ? ({ isPlaceholder: true } as const)
    : { teamId, projectId, environmentId, service };

  const queryClient = useQueryClient();
  const volumes = service?.config.volumes;
  const buttonIntentProps = useIntent({
    onIntent: () => {
      if (isPlaceholder) return;
      const input = {
        teamId,
        projectId,
        environmentId,
        serviceId: service.id,
      };
      queryClient.prefetchQuery(deploymentsListQuery(input));
      queryClient.prefetchQuery(serviceQuery(input));
    },
    enabled: !isPlaceholder,
  });

  return (
    <li
      data-placeholder={isPlaceholder || undefined}
      className={cn("group/item flex min-h-38 w-full flex-col p-1", className)}
    >
      <ServicePanelOrPlaceholder {...panelProps}>
        <Button
          variant="ghost"
          className={cn(
            "bg-background-hover flex w-full flex-1 flex-col items-start gap-6 rounded-xl border px-5 py-3.5 text-left font-semibold",
            classNameCard,
            volumes && volumes.length > 0 && "rounded-b-none border-b-0",
          )}
          {...buttonIntentProps}
        >
          {service && <NewEntityIndicator id={service.id} />}
          <div className="flex w-full items-center justify-start gap-2">
            {!isPlaceholder ? (
              <ServiceIcon service={service} className="-ml-1 size-6" />
            ) : (
              <div className="animate-skeleton bg-foreground -ml-1 size-6 rounded-full" />
            )}
            <h3 className="group-data-placeholder/item:bg-foreground group-data-placeholder/item:animate-skeleton min-w-0 shrink overflow-hidden leading-tight text-ellipsis whitespace-nowrap group-data-placeholder/item:rounded-md group-data-placeholder/item:text-transparent">
              {!isPlaceholder ? service.name : "Loading"}
            </h3>
          </div>
          <div className="flex w-full flex-1 flex-col justify-end">
            <div className="-mx-0.5 flex w-[calc(100%+0.25rem)] items-center justify-between">
              {!isPlaceholder ? (
                <ServiceInfoLine
                  className="min-w-0 shrink overflow-hidden text-sm font-normal text-ellipsis whitespace-nowrap"
                  service={service}
                />
              ) : (
                <p className="bg-muted-foreground animate-skeleton min-w-0 shrink overflow-hidden rounded-md text-sm font-normal text-ellipsis whitespace-nowrap text-transparent">
                  10 min. ago via GitHub
                </p>
              )}
            </div>
          </div>
        </Button>
      </ServicePanelOrPlaceholder>
      {volumes && volumes.length > 0 && (
        <div className={cn("bg-background-hover rounded-b-xl text-xs", classNameVolumes)}>
          {volumes.map((volume, index) => (
            <VolumeLine
              key={volume.id}
              volume={volume}
              className={cn(
                classNameVolume,
                index !== 0 && "-mt-px",
                index === volumes.length - 1 && (classNameVolumeLast || "rounded-b-xl"),
              )}
            />
          ))}
        </div>
      )}
    </li>
  );
}

function ServicePanelOrPlaceholder({
  teamId,
  projectId,
  environmentId,
  service,
  isPlaceholder,
  children,
}: { children: ReactNode } & (
  | {
      teamId: string;
      projectId: string;
      environmentId: string;
      service: TServiceShallow;
      isPlaceholder?: never;
    }
  | {
      teamId?: never;
      projectId?: never;
      environmentId?: never;
      service?: never;
      isPlaceholder: true;
    }
)) {
  if (isPlaceholder) {
    return children;
  }

  return (
    <ServicePanel
      teamId={teamId}
      projectId={projectId}
      environmentId={environmentId}
      service={service}
    >
      {children}
    </ServicePanel>
  );
}

type TServiceInfoLineProps = {
  service: TService;
  className?: string;
};

type TDeployment = NonNullable<TService["last_deployment"]>;

// A cancelled build is a deliberate no-op, fall back to the service's actual state
function getDisplayDeployment(service: TServiceShallow): TDeployment | undefined {
  const last = service.last_deployment;
  if (last?.status !== "build-cancelled") return last;
  const current = service.current_deployment;
  if (current && current.status !== "removed") return current;
  return current ?? undefined;
}

function ServiceInfoLine({ service, className }: TServiceInfoLineProps) {
  const deployment = getDisplayDeployment(service);
  const showOfflineFallback = !deployment && Boolean(service.last_deployment);

  return (
    <div
      className={cn(
        "text-muted-foreground flex w-full items-center justify-start gap-1.75",
        className,
      )}
    >
      {(deployment || showOfflineFallback) && (
        <StatusIndicator status={deployment?.status || "removed"} />
      )}
      <StatusText
        service={service}
        deployment={deployment}
        showOfflineFallback={showOfflineFallback}
      />
    </div>
  );
}

function StatusTextWrapper({
  deployment,
  children,
}: {
  deployment: TDeployment | undefined;
  children: ReactNode;
}) {
  const color = useMemo(() => {
    if (deployment?.status === "crashing") return "destructive";
    if (deployment?.status === "build-failed") return "destructive";
    if (deployment?.status === "launch-error") return "destructive";
    return "default";
  }, [deployment?.status]);

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
  deployment,
  duration,
  children,
}: {
  deployment: TDeployment;
  duration: string;
  children: ReactNode;
}) {
  return (
    <StatusTextWrapper deployment={deployment}>
      {children}
      <span className="text-muted-most-foreground px-[0.75ch]">|</span>
      <span className="font-mono" suppressHydrationWarning>
        {duration}
      </span>
    </StatusTextWrapper>
  );
}

function StatusText({
  service,
  deployment,
  showOfflineFallback,
}: {
  service: TServiceShallow;
  deployment: TDeployment | undefined;
  showOfflineFallback: boolean;
}) {
  const { str: timeDiffStr } = useTimeDifference({
    timestamp: deployment ? new Date(deployment.created_at).getTime() : 0,
  });

  const now = useNow();
  const durationStr = getDurationStr({
    end: now,
    start: new Date(deployment?.created_at || now).getTime(),
  });

  if (!deployment) {
    if (showOfflineFallback) {
      return <StatusTextWrapper deployment={deployment}>Offline</StatusTextWrapper>;
    }
    return "No deployments yet";
  }
  if (deployment.status === "build-queued") {
    return (
      <StatusWithDuration deployment={deployment} duration={durationStr}>
        Build queued
      </StatusWithDuration>
    );
  }
  if (deployment.status === "build-pending") {
    return (
      <StatusWithDuration deployment={deployment} duration={durationStr}>
        Pending build
      </StatusWithDuration>
    );
  }
  if (deployment.status === "build-running") {
    return (
      <StatusWithDuration deployment={deployment} duration={durationStr}>
        Building
      </StatusWithDuration>
    );
  }
  if (deployment.status === "build-succeeded" || deployment.status === "launching") {
    return <StatusTextWrapper deployment={deployment}>Launching</StatusTextWrapper>;
  }
  if (deployment.status === "launch-error") {
    return <StatusTextWrapper deployment={deployment}>Couldn't launch</StatusTextWrapper>;
  }
  if (deployment.status === "build-failed") {
    return <StatusTextWrapper deployment={deployment}>Build failed</StatusTextWrapper>;
  }
  if (deployment.status === "build-cancelled") {
    return <StatusTextWrapper deployment={deployment}>Build cancelled</StatusTextWrapper>;
  }
  if (deployment.status === "crashing") {
    return <StatusTextWrapper deployment={deployment}>Crashing</StatusTextWrapper>;
  }
  if (deployment.status === "removed") {
    return <StatusTextWrapper deployment={deployment}>Offline</StatusTextWrapper>;
  }
  if (deployment.status === "active")
    return (
      <StatusTextWrapper deployment={deployment}>
        Online <span className="text-muted-most-foreground px-[0.75ch]">|</span> {timeDiffStr} via{" "}
        {sourceToTitle[service.type] || "Unknown"}
      </StatusTextWrapper>
    );
}

function StatusIndicator({ status }: { status: TDeployment["status"] }) {
  if (status === "build-queued" || status === "build-pending") {
    return <HourglassIcon className="animate-hourglass size-3.5 shrink-0" />;
  }
  if (status === "build-running" || status === "build-succeeded" || status === "launching") {
    return <LoaderIcon className="size-3.5 shrink-0 animate-spin" />;
  }
  if (status === "build-failed") {
    return <TriangleAlertIcon className="text-destructive size-3.5 shrink-0" />;
  }
  if (status === "build-cancelled") {
    return <OctagonXIcon className="size-3.5 shrink-0" />;
  }
  if (status === "launch-error") {
    return <TriangleAlertIcon className="text-destructive size-3.5 shrink-0" />;
  }
  if (status === "crashing") {
    return <TriangleAlertIcon className="text-destructive size-3.5 shrink-0" />;
  }
  if (status === "removed") {
    return (
      <div className="-ml-px flex size-3.5 shrink-0 items-center justify-center">
        <div className="flex size-3 items-center justify-center rounded-full shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--muted-foreground)_40%,transparent)]">
          <div className="bg-muted-foreground size-1.5 rounded-full" />
        </div>
      </div>
    );
  }
  return (
    <div className="-ml-px flex size-3.5 shrink-0 items-center justify-center">
      <div className="flex size-3 items-center justify-center rounded-full shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--success)_40%,transparent)]">
        <div className="bg-success size-1.5 rounded-full" />
      </div>
    </div>
  );
}
