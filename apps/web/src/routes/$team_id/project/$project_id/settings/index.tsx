import { createFileRoute } from "@tanstack/react-router";

import GeneralTabContent from "@/components/project/settings/general-tab-content";
import SettingsTabTitle from "@/components/settings/settings-tab-title";

export const Route = createFileRoute("/$team_id/project/$project_id/settings/")({
  component: ProjectGeneralSettings,
});

function ProjectGeneralSettings() {
  const { team_id: teamId, project_id: projectId } = Route.useParams();
  return (
    <>
      <SettingsTabTitle>General</SettingsTabTitle>
      <GeneralTabContent className="mt-3" teamId={teamId} projectId={projectId} />
    </>
  );
}
