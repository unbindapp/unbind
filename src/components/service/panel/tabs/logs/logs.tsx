import LogViewer from "@/components/logs/log-viewer";
import { useService } from "@/components/service/service-provider";

export default function Logs() {
  const { teamId, projectId, environmentId, serviceId } = useService();
  return (
    <LogViewer
      containerType="sheet"
      teamId={teamId}
      projectId={projectId}
      environmentId={environmentId}
      serviceId={serviceId}
      type="service"
      hideServiceByDefault
      since="24h"
    />
  );
}
