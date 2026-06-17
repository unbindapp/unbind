import { createFileRoute } from "@tanstack/react-router";

import EnvironmentsProvider from "@/components/environment/environments-provider";
import EnvironmentsTabContent from "@/components/environment/environments-tab-content";
import SettingsTabTitle from "@/components/settings/settings-tab-title";

export const Route = createFileRoute("/_authed/$team_id/project/$project_id/settings/environments")(
  {
    component: ProjectEnvironmentsSettings,
  },
);

function ProjectEnvironmentsSettings() {
  const { team_id: teamId, project_id: projectId } = Route.useParams();
  return (
    <EnvironmentsProvider teamId={teamId} projectId={projectId}>
      <SettingsTabTitle>Environments</SettingsTabTitle>
      <EnvironmentsTabContent />
    </EnvironmentsProvider>
  );
}
