import { createFileRoute } from "@tanstack/react-router";

import GeneralTabContent from "@/components/project/settings/general-tab-content";

export const Route = createFileRoute("/_authed/$team_id/project/$project_id/settings/")({
  component: ProjectGeneralSettings,
});

function ProjectGeneralSettings() {
  const { team_id: teamId, project_id: projectId } = Route.useParams();
  return <GeneralTabContent teamId={teamId} projectId={projectId} />;
}
