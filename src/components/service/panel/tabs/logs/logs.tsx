import LogViewer from "@/components/logs/log-viewer";
import { useService } from "@/components/service/service-provider";
import { TServiceShallow } from "@/server/trpc/api/services/types";

export default function Logs({}: { service: TServiceShallow }) {
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
