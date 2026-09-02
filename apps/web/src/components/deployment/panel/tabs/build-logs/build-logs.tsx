import { useDeployment } from "@/components/deployment/deployment-provider";
import ErrorLine from "@/components/error-line";
import LogViewer from "@/components/logs/log-viewer";
import TabWrapper from "@/components/navigation/tab-wrapper";
import { ScrollArea } from "@/components/ui/scroll-area";
import { expectsBuildLogs } from "@/lib/helpers/deployment-expects-logs";
import { buildLogsWindow } from "@/lib/helpers/deployment-log-window";
import { TDeploymentShallow } from "@/lib/queries/deployments";
import { TriangleAlertIcon } from "lucide-react";
import { useLogsWindow } from "../use-logs-window";

type TProps = {
  deployment: TDeploymentShallow;
};

export default function BuildLogs({ deployment }: TProps) {
  const { teamId, projectId, environmentId, serviceId, deploymentId } = useDeployment();

  const { start, end } = useLogsWindow(deployment, buildLogsWindow);

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
      type="build"
      hideServiceByDefault
      shouldHaveLogs={expectsBuildLogs(deployment)}
      httpDefaultStartTimestamp={start}
      httpDefaultEndTimestamp={end}
    />
  );
}
