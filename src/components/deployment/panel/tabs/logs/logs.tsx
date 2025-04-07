import { useDeployment } from "@/components/deployment/deployment-provider";
import LogViewer from "@/components/logs/log-viewer";
import { TDeploymentShallow } from "@/server/trpc/api/deployments/types";

type TProps = {
  deployment: TDeploymentShallow;
};

const hourInMs = 60 * 60 * 1000;

export default function Logs({ deployment }: TProps) {
  const { teamId, projectId, environmentId, serviceId, deploymentId } = useDeployment();

  const createdAt = deployment.created_at;
  const completedAt = deployment.completed_at;

  const createdAtTimestamp = createdAt ? new Date(createdAt).getTime() : undefined;
  const completedAtTimestamp = completedAt ? new Date(completedAt).getTime() : undefined;

  return (
    <LogViewer
      containerType="sheet"
      teamId={teamId}
      projectId={projectId}
      environmentId={environmentId}
      serviceId={serviceId}
      deploymentId={deploymentId}
      type="deployment"
      hideServiceByDefault
      shouldHaveLogs={deployment.status === "building" || deployment.status === "queued"}
      httpDefaultEndTimestamp={completedAtTimestamp ? completedAtTimestamp + hourInMs : undefined}
      httpDefaultStartTimestamp={createdAtTimestamp ? createdAtTimestamp - hourInMs : undefined}
      disableStream={createdAtTimestamp !== undefined && completedAtTimestamp !== undefined}
    />
  );
}
