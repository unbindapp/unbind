import { useDeploymentPanel } from "@/components/deployment/panel/deployment-panel-provider";
import ErrorLine from "@/components/error-line";
import NoItemsCard from "@/components/no-items-card";
import { useService } from "@/components/service/service-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { getDurationStr, useTimeDifference } from "@/lib/hooks/use-time-difference";
import { cronRunsListQuery, startCronRun, TCronRun } from "@/lib/queries/cron";
import { TServiceShallow } from "@/lib/queries/services";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CalendarClockIcon,
  CircleCheckIcon,
  LoaderIcon,
  PlayIcon,
  TriangleAlertIcon,
} from "lucide-react";

export default function CronRuns({ service }: { service: TServiceShallow }) {
  const { teamId, projectId, environmentId, serviceId } = useService();
  const ids = { teamId, projectId, environmentId, serviceId };
  const { data, isPending, error, refetch } = useQuery({
    ...cronRunsListQuery(ids),
    refetchInterval: 5000,
  });
  const { openPanel } = useDeploymentPanel();

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
    <div className="flex w-full flex-col gap-2 pb-3">
      <div className="flex w-full items-center justify-between gap-2 px-2">
        <h3 className="text-muted-foreground leading-tight font-medium">Runs</h3>
        <Button
          type="button"
          variant="outline"
          disabled={isPending || isRunning || service.config.stopped}
          isPending={isStarting}
          onClick={() => runNow(ids)}
          className="gap-1.5"
        >
          <PlayIcon className="-ml-0.5 size-4 shrink-0" />
          <p className="min-w-0 shrink">{isRunning ? "Running" : "Run Now"}</p>
        </Button>
      </div>
      {startError && <ErrorLine message={startError.message} />}
      {!data && error && <ErrorLine message={error.message} />}
      {!data && !error && (
        <div className="bg-muted-foreground animate-skeleton h-10.5 w-full rounded-lg" />
      )}
      {data && data.runs.length === 0 && (
        <NoItemsCard Icon={CalendarClockIcon}>
          No runs yet. The first one starts at the next tick of the schedule.
        </NoItemsCard>
      )}
      {data && data.runs.length > 0 && (
        <ol className="flex w-full flex-col gap-2">
          {data.runs.map((run) => (
            <li className="w-full" key={run.name}>
              <RunLine
                run={run}
                onOpen={
                  run.deployment_id
                    ? () => openPanel(run.deployment_id as string, "deploy-logs")
                    : undefined
                }
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

type TRunTone = "muted" | "success" | "destructive";

function describeRun(run: TCronRun): {
  Icon: typeof CircleCheckIcon;
  tone: TRunTone;
  text: string;
} {
  switch (run.status) {
    case "running":
      return { Icon: LoaderIcon, tone: "muted", text: "Running" };
    case "failed":
      return {
        Icon: TriangleAlertIcon,
        tone: "destructive",
        text: run.failure_reason ? `Failed: ${run.failure_reason}` : "Failed",
      };
    case "succeeded": {
      const started = run.started_at ?? run.created_at;
      const duration = run.completed_at
        ? getDurationStr({ start: started, end: run.completed_at })
        : "";
      return {
        Icon: CircleCheckIcon,
        tone: "success",
        text: duration ? `Succeeded in ${duration}` : "Succeeded",
      };
    }
  }
}

function RunLine({ run, onOpen }: { run: TCronRun; onOpen?: () => void }) {
  const { str: timeAgo } = useTimeDifference({ timestamp: new Date(run.created_at).getTime() });
  const { Icon, tone, text } = describeRun(run);
  const trigger = run.manual ? "Started manually" : "Scheduled";
  const meta = timeAgo ? `${trigger}, ${timeAgo}` : trigger;

  const content = (
    <>
      <div className="line-icon text-muted-foreground group-data-[tone=destructive]/line:text-destructive group-data-[tone=success]/line:text-success">
        <Icon
          className={cn("-ml-0.5 size-4 shrink-0", run.status === "running" && "animate-spin")}
        />
      </div>
      <p className="min-w-0 flex-1 text-left font-medium wrap-break-word">{text}</p>
      <p className="text-muted-foreground shrink-0 text-sm">{meta}</p>
    </>
  );
  const className =
    "group/line flex w-full min-w-0 items-start gap-2 rounded-lg border px-3 py-2.5 leading-tight";

  if (!onOpen) {
    return (
      <div data-tone={tone} className={className}>
        {content}
      </div>
    );
  }
  return (
    <button
      type="button"
      data-tone={tone}
      onClick={onOpen}
      title="Open the logs of this run's deployment"
      className={cn(
        className,
        "has-hover:hover:bg-border/8-10 active:bg-border/8-10 focus-visible:ring-primary/8-10 cursor-pointer focus-visible:ring-1 focus-visible:outline-hidden",
      )}
    >
      {content}
    </button>
  );
}
