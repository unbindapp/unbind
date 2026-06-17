import { createFileRoute } from "@tanstack/react-router";

import { environmentsListQuery } from "@/api/queries/environments";
import EnvironmentsProvider from "@/components/environment/environments-provider";
import EnvironmentsTabContent from "@/components/environment/environments-tab-content";
import SettingsTabTitle from "@/components/settings/settings-tab-title";

export const Route = createFileRoute("/_authed/$team_id/project/$project_id/settings/environments/")(
  {
    // Runs on intent preload (hover) so hovering the tab warms the cache
    // before navigation. Non-blocking; the provider shows skeletons meanwhile.
    loader: ({ context: { queryClient }, params }) => {
      void queryClient.prefetchQuery(environmentsListQuery(params.team_id, params.project_id));
    },
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
