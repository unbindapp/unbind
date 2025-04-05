import { useDeployment } from "@/components/deployment/deployment-provider";
import LogViewer from "@/components/logs/log-viewer";

export default function Logs() {
  const { teamId, projectId, environmentId, serviceId, deploymentId } = useDeployment();
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
    />
  );
}
