import { createFileRoute, useSearch } from "@tanstack/react-router";

import LogViewer from "@/components/logs/log-viewer";
import ServicesProvider from "@/components/service/services-provider";

const projectRouteId = "/_authed/$team_id/project/$project_id";

export const Route = createFileRoute("/_authed/$team_id/project/$project_id/logs")({
  component: LogsPage,
});

function LogsPage() {
  const { team_id: teamId, project_id: projectId } = Route.useParams();
  const { environment } = useSearch({ from: projectRouteId });
  const environmentId = environment ?? "";

  return (
    <ServicesProvider teamId={teamId} projectId={projectId} environmentId={environmentId}>
      <LogViewer
        containerType="page"
        teamId={teamId}
        projectId={projectId}
        environmentId={environmentId}
        type="environment"
      />
    </ServicesProvider>
  );
}
