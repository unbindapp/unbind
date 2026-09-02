import { useDeployment } from "@/components/deployment/deployment-provider";
import ErrorLine from "@/components/error-line";
import LogViewer from "@/components/logs/log-viewer";
import TabWrapper from "@/components/navigation/tab-wrapper";
import { ScrollArea } from "@/components/ui/scroll-area";
import { expectsDeployLogs } from "@/lib/helpers/deployment-expects-logs";
import { deployLogsWindow } from "@/lib/helpers/deployment-log-window";
import { TDeploymentShallow } from "@/lib/queries/deployments";
import { TriangleAlertIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type TProps = {
  deployment: TDeploymentShallow;
};

export default function DeployLogs({ deployment }: TProps) {
  const { teamId, projectId, environmentId, serviceId, deploymentId } = useDeployment();

  // Kept in state so the pinned end doesn't move with every render.
  const [now, setNow] = useState(() => Date.now());
  const { start, end, liveUntil } = useMemo(
    () => deployLogsWindow(deployment, now),
    [deployment, now],
  );

  useEffect(() => {
    if (liveUntil === undefined) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, liveUntil - now));
    return () => clearTimeout(timer);
  }, [liveUntil, now]);

  if (deployment.error && !deployment.job_name) {
    return (
      <ScrollArea>
        <TabWrapper>
          <div className="flex w-full flex-col gap-3">
            <div className="text-destructive flex w-full items-center justify-start gap-2 px-1.5">
              <TriangleAlertIcon className="size-4 shrink-0" />
              <h3 className="shrink leading-tight font-semibold">Failed before the build stage</h3>
            </div>
            <ErrorLine
              className="border-destructive/8 text-muted-foreground bg-destructive/6 border"
              message={deployment.error}
            ></ErrorLine>
          </div>
        </TabWrapper>
      </ScrollArea>
    );
  }

  return (
    <LogViewer
      error={deployment.error}
      containerType="sheet"
      teamId={teamId}
      projectId={projectId}
      environmentId={environmentId}
      serviceId={serviceId}
      deploymentId={deploymentId}
      type="deployment"
      hideServiceByDefault
      shouldHaveLogs={expectsDeployLogs(deployment)}
      httpDefaultStartTimestamp={start}
      httpDefaultEndTimestamp={end}
    />
  );
}
