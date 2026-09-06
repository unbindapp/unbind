import {
  useStagedChangesPlan,
  useServiceChangeCount,
} from "@/components/staged-changes/staged-changes-provider";
import OnlineIcon from "@/components/icons/online";
import { NewEntityIndicator } from "@/components/new-entity-indicator";
import { useNow } from "@/components/providers/now-provider";
import { servicePanelServiceIdKey } from "@/components/service/panel/constants";
import ServicePanel from "@/components/service/panel/service-panel";
import ServiceIcon from "@/components/service/service-icon";
import { Button, LinkButton } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import VolumeLine from "@/components/volume/volume-line";
import { sourceToTitle } from "@/lib/constants";
import { useIntent } from "@/lib/hooks/use-intent";
import { deleteMutationKeys, useIsDeleting } from "@/lib/hooks/use-is-deleting";
import { getDurationStr, useTimeDifference } from "@/lib/hooks/use-time-difference";
import { deploymentsListQuery } from "@/lib/queries/deployments";
import { instanceHealthQuery } from "@/lib/queries/instances";
import {
  serviceEndpointsQuery,
  serviceQuery,
  TService,
  TServiceShallow,
} from "@/lib/queries/services";
import { useQueryClient } from "@tanstack/react-query";
import {
  HourglassIcon,
  LoaderIcon,
  OctagonXIcon,
  PowerIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { ReactElement, ReactNode, useMemo } from "react";

type TProps = {
  className?: string;
  isDeleting?: boolean;
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
  isDeleting: isDeletingProp,
  className,
  classNameCard,
  classNameVolumes,
  classNameVolume,
  classNameVolumeLast,
}: TProps) {
  const isOwnDeleting = useIsDeleting(deleteMutationKeys.service(service?.id ?? ""));
  const isDeleting = Boolean(isDeletingProp || isOwnDeleting);
  const panelProps = isPlaceholder
    ? ({ isPlaceholder: true } as const)
    : { teamId, projectId, environmentId, service };

  const queryClient = useQueryClient();
  const volumes = service?.config.volumes;
  const changeCount = useServiceChangeCount(service?.id ?? "");
  const { affectedByService } = useStagedChangesPlan();
  const affectedAction = service ? affectedByService.get(service.id)?.action : undefined;
  const changeLabel =
    changeCount > 0
      ? `${changeCount} ${changeCount === 1 ? "Change" : "Changes"}`
      : affectedAction && affectedAction !== "none"
        ? "Will Redeploy"
        : null;
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
      queryClient.prefetchQuery(serviceEndpointsQuery(input));
      queryClient.prefetchQuery(instanceHealthQuery(input));
    },
    enabled: !isPlaceholder && !isDeleting,
  });

  const cardClassName = cn(
    "flex w-full flex-1 flex-col items-start gap-6 rounded-xl border px-5 py-3.5 text-left font-semibold data-staged:border-change/24",
    classNameCard,
    volumes && volumes.length > 0 && "rounded-b-none border-b-0",
  );

  const cardContent = (
    <>
      {changeLabel !== null && <div className="bg-change/4 absolute top-0 left-0 size-full" />}
      {service && <NewEntityIndicator id={service.id} />}
      <div className="flex w-full items-center justify-between gap-4">
        <div className="flex min-w-0 shrink items-center justify-start gap-2">
          {!isPlaceholder ? (
            <ServiceIcon service={service} className="-ml-1 size-5" />
          ) : (
            <div className="animate-skeleton bg-foreground -ml-1 size-5 rounded-full" />
          )}
          <h3 className="group-data-placeholder/item:bg-foreground group-data-placeholder/item:animate-skeleton min-w-0 shrink overflow-hidden leading-tight text-ellipsis whitespace-nowrap group-data-placeholder/item:rounded-md group-data-placeholder/item:text-transparent">
            {!isPlaceholder ? service.name : "Loading"}
          </h3>
        </div>
        {changeLabel !== null && (
          <div className="bg-background -mr-1.5 max-w-1/2 shrink-0 rounded-sm">
            <p className="text-change bg-change/12 border-change/12 truncate rounded-sm border px-1.5 py-0.5 text-xs font-medium">
              {changeLabel}
            </p>
          </div>
        )}
      </div>
      <div className="flex w-full flex-1 flex-col justify-end">
        <div className="-mx-0.5 flex w-[calc(100%+0.25rem)] items-center justify-between">
          {!isPlaceholder ? (
            <ServiceInfoLine
              className="min-w-0 shrink overflow-hidden text-sm font-normal text-ellipsis whitespace-nowrap"
              service={service}
              isDeleting={isDeleting}
            />
          ) : (
            <p className="bg-muted-foreground animate-skeleton min-w-0 shrink overflow-hidden rounded-md text-sm font-normal text-ellipsis whitespace-nowrap text-transparent">
              10 min. ago via GitHub
            </p>
          )}
        </div>
      </div>
    </>
  );

  return (
    <li
      data-placeholder={isPlaceholder || undefined}
      data-deleting={isDeleting || undefined}
      data-staged={changeLabel !== null || undefined}
      className={cn(
        "group/item data-deleting:animate-skeleton-smooth-weaker flex min-h-40 w-full flex-col p-1 transition-opacity duration-(--skeleton-smooth-lead-in) data-deleting:pointer-events-none data-deleting:opacity-(--skeleton-smooth-weaker-opacity)",
        className,
      )}
    >
      <ServicePanelOrPlaceholder {...panelProps}>
        {isPlaceholder ? (
          <Button variant="card" className={cardClassName}>
            {cardContent}
          </Button>
        ) : (
          <LinkButton
            data-staged={changeLabel !== null || undefined}
            variant="card"
            from="/$team_id/project/$project_id"
            to="."
            search={(prev) => ({ ...prev, [servicePanelServiceIdKey]: service.id })}
            replace={true}
            resetScroll={false}
            disabled={isDeleting}
            className={cardClassName}
            {...buttonIntentProps}
          >
            {cardContent}
          </LinkButton>
        )}
      </ServicePanelOrPlaceholder>
      {volumes && volumes.length > 0 && (
        <div className={cn("bg-background rounded-b-xl text-xs", classNameVolumes)}>
          {volumes.map((volume, index) => (
            <VolumeLine
              key={volume.id}
              volume={volume}
              className={cn(
                classNameVolume,
                index === volumes.length - 1 && "group-data-staged/item:border-change/24",
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
}: { children: ReactElement } & (
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
  isDeleting: boolean;
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

function ServiceInfoLine({ service, isDeleting, className }: TServiceInfoLineProps) {
  const deployment = getDisplayDeployment(service);
  const showOfflineFallback = !deployment && Boolean(service.last_deployment);

  if (isDeleting) {
    return (
      <div
        className={cn(
          "text-destructive flex w-full items-center justify-start gap-1.75",
          className,
        )}
      >
        <LoaderIcon className="size-3.5 shrink-0 animate-spin" />
        <p className="min-w-0 shrink truncate">Deleting</p>
      </div>
    );
  }

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
    return <PowerIcon className="size-3.5 shrink-0" />;
  }
  return <OnlineIcon className="text-success size-3.5 shrink-0" />;
}
