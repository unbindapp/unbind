import { deploymentCardClassName } from "@/components/deployment/deployment-card";
import {
  AnimatedLoaderIcon,
  StatusChip,
  type TStatusColor,
} from "@/components/deployment/deployment-status-chip";
import { deploymentPanelTabKey } from "@/components/deployment/panel/constants";
import { useDeploymentPanel } from "@/components/deployment/panel/deployment-panel-provider";
import ErrorCard from "@/components/error-card";
import ErrorLine from "@/components/error-line";
import AnimatedTimerIcon from "@/components/icons/animated-timer";
import NoItemsCard from "@/components/no-items-card";
import { useNow } from "@/components/providers/now-provider";
import { useService } from "@/components/service/service-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { getDurationStr, useTimeDifference } from "@/lib/hooks/use-time-difference";
import { cronRunsListQuery, startCronRun, TCronRun } from "@/lib/queries/cron";
import { TServiceShallow } from "@/lib/queries/services";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarClockIcon, CircleCheckIcon, PlayIcon, TriangleAlertIcon } from "lucide-react";
import { FC } from "react";

const placeholderArray = Array.from({ length: 3 }, (_, i) => i);

export default function CronRuns({ service }: { service: TServiceShallow }) {
  const { teamId, projectId, environmentId, serviceId } = useService();
  const ids = { teamId, projectId, environmentId, serviceId };
  const { data, isPending, error, refetch } = useQuery({
    ...cronRunsListQuery(ids),
    refetchInterval: 5000,
  });

  const isRunning = data?.runs.some((run) => run.status === "running") ?? false;
  const {
    mutate: runNow,
    isPending: isStarting,
    error: startError,
  } = useMutation({
    mutationFn: startCronRun,
    onSuccess: () => refetch(),
  });

  return (
    <>
      <div
        data-pending={isPending || undefined}
        className="group/header flex w-full items-center justify-between gap-2 px-2 pb-1"
      >
        <h3 className="text-muted-foreground group-data-pending/header:bg-muted-foreground group-data-pending/header:animate-skeleton leading-tight font-medium group-data-pending/header:rounded-md group-data-pending/header:text-transparent">
          Runs
        </h3>
        <Button
          type="button"
          variant="outline"
          disabled={isPending || isRunning || service.config.stopped}
          fadeOnDisabled={false}
          isPending={isStarting}
          onClick={() => runNow(ids)}
          className="group-data-pending/header:bg-muted-more-foreground group-data-pending/header:animate-skeleton -my-1.5 -mr-2 shrink-0 gap-1.5 px-3 py-2 font-semibold group-data-pending/header:text-transparent"
        >
          <PlayIcon className="-ml-1 size-5 shrink-0" />
          <p className="min-w-0 shrink">{isRunning ? "Running" : "Run Now"}</p>
        </Button>
      </div>
      {startError && <ErrorLine message={startError.message} />}
      {data && data.runs.length === 0 && (
        <NoItemsCard Icon={CalendarClockIcon}>
          No runs yet. The first one starts at the next tick of the schedule.
        </NoItemsCard>
      )}
      {data && data.runs.length > 0 && (
        <ol className="flex w-full flex-col gap-2">
          {data.runs.map((run) => (
            <li className="w-full" key={run.name}>
              <RunCard run={run} />
            </li>
          ))}
        </ol>
      )}
      {!data && isPending && placeholderArray.map((i) => <RunCard key={i} isPlaceholder />)}
      {!data && !isPending && error && <ErrorCard message={error.message} />}
    </>
  );
}

type TRunProps = { run: TCronRun; isPlaceholder?: never } | { run?: never; isPlaceholder: true };

function describeRun(run: TCronRun | undefined): {
  text: string;
  Icon: FC<{ className?: string }>;
  color: TStatusColor;
} {
  switch (run?.status) {
    case "running":
      return { text: "RUNNING", Icon: AnimatedLoaderIcon, color: "process" };
    case "failed":
      return { text: "FAILED", Icon: TriangleAlertIcon, color: "destructive" };
    case "succeeded":
      return { text: "SUCCEEDED", Icon: CircleCheckIcon, color: "success" };
    default:
      return { text: "LOADING", Icon: AnimatedLoaderIcon, color: "default" };
  }
}

function RunCard({ run, isPlaceholder }: TRunProps) {
  const { getOpenSearch } = useDeploymentPanel();
  const now = useNow();
  const { str: timeAgo } = useTimeDifference({
    timestamp: run ? new Date(run.created_at).getTime() : Date.now(),
  });
  const { text, Icon, color } = describeRun(run);
  const isRunning = run?.status === "running";
  const started = run?.started_at ?? run?.created_at;
  const durationStr =
    !run || !started
      ? undefined
      : run.completed_at
        ? getDurationStr({ start: started, end: run.completed_at })
        : isRunning
          ? getDurationStr({ start: started, end: now })
          : undefined;
  const skeleton =
    "group-data-placeholder/card:bg-foreground group-data-placeholder/card:animate-skeleton group-data-placeholder/card:rounded-md group-data-placeholder/card:text-transparent";

  const content = (
    <>
      <div className="flex flex-col items-start justify-start sm:w-34 sm:pr-3">
        <StatusChip text={text} Icon={Icon} color={color} isPlaceholder={isPlaceholder} />
      </div>
      <div className="mt-1.5 flex min-w-0 flex-1 flex-col gap-1.25 pb-0.5 sm:mt-0">
        <p className={cn("max-w-full min-w-0 shrink leading-tight wrap-break-word", skeleton)}>
          {!run ? "Scheduled" : run.manual ? "Started manually" : "Scheduled"}
        </p>
        <div className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono text-sm leading-tight">
          <p className={cn("min-w-0 shrink", skeleton)}>{run ? timeAgo : "1 hr. ago"}</p>
          {(isPlaceholder || durationStr) && (
            <>
              <span className="text-muted-most-foreground">|</span>
              <p className={cn("min-w-0 shrink", skeleton)}>
                <span className="inline-icon mr-[0.4ch]">
                  <AnimatedTimerIcon animate={isRunning} className="size-3.5 shrink-0" />
                </span>
                {durationStr ?? "0:05"}
              </p>
            </>
          )}
        </div>
        {run?.failure_reason && (
          <p className="text-destructive min-w-0 shrink text-sm leading-tight wrap-break-word">
            {run.failure_reason}
          </p>
        )}
      </div>
    </>
  );
  const className = cn(deploymentCardClassName, "sm:pr-4");

  return (
    <div
      data-color={color}
      data-placeholder={isPlaceholder || undefined}
      className="group/card relative flex w-full flex-row items-stretch rounded-xl"
    >
      {run?.deployment_id ? (
        <Link
          from="/$team_id/project/$project_id"
          to="."
          search={(prev) => ({
            ...prev,
            ...getOpenSearch(run.deployment_id as string),
            [deploymentPanelTabKey]: "deploy-logs",
          })}
          replace={true}
          resetScroll={false}
          className={className}
        >
          {content}
        </Link>
      ) : (
        <div className={className}>{content}</div>
      )}
    </div>
  );
}
