import { useDeployment } from "@/components/deployment/deployment-provider";
import ErrorLine from "@/components/error-line";
import LogViewer from "@/components/logs/log-viewer";
import TabWrapper from "@/components/navigation/tab-wrapper";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TDeploymentShallow } from "@/server/trpc/api/deployments/types";
import { TriangleAlertIcon } from "lucide-react";

type TProps = {
  deployment: TDeploymentShallow;
};

const hourInMs = 60 * 60 * 1000;

export default function BuildLogs({ deployment }: TProps) {
  const { teamId, projectId, environmentId, serviceId, deploymentId } = useDeployment();

  const createdAt = deployment.created_at;
  const completedAt = deployment.completed_at;

  const createdAtTimestamp = createdAt ? new Date(createdAt).getTime() : undefined;
  const completedAtTimestamp = completedAt ? new Date(completedAt).getTime() : undefined;

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

  const shouldHaveLogs =
    deployment?.status === "build-queued" ||
    deployment?.status === "build-pending" ||
    deployment?.status === "build-running" ||
    deployment?.status === "build-succeeded" ||
    deployment?.status === "pending";

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
      shouldHaveLogs={shouldHaveLogs}
      httpDefaultStartTimestamp={createdAtTimestamp ? createdAtTimestamp - hourInMs : undefined}
      httpDefaultEndTimestamp={completedAtTimestamp ? completedAtTimestamp + hourInMs : undefined}
    />
  );
}
