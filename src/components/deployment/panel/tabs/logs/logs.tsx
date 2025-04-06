import { useDeployment } from "@/components/deployment/deployment-provider";
import LogViewer from "@/components/logs/log-viewer";
import { TLogsStreamProps } from "@/components/logs/logs-provider";
import { TDeploymentShallow } from "@/server/trpc/api/deployments/types";

type TProps = {
  deployment: TDeploymentShallow;
};

const hourInMs = 60 * 60 * 1000;

export default function Logs({ deployment }: TProps) {
  const { teamId, projectId, environmentId, serviceId, deploymentId } = useDeployment();
  const completedAt = deployment.completed_at;

  const createdAtTimestamp = new Date(deployment.created_at).getTime();
  const completedAtTimestamp = completedAt ? new Date(completedAt).getTime() : null;

  const streamProps: TLogsStreamProps =
    completedAt && completedAtTimestamp
      ? {
          streamDisabled: true,
          start: new Date(createdAtTimestamp - hourInMs).toISOString(),
          end: new Date(completedAtTimestamp + hourInMs).toISOString(),
        }
      : { since: "24h" };

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
      {...streamProps}
    />
  );
}
